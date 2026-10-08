# SCADA Mobile — анализ контрактов

Источник: исходный код боевых сервисов в `writehost/scada_system`
(`app/api/**/route.ts`, `lib/**`, `yms-app/app/api/**`), `openapi/wms.openapi.json`
(281 путь), `docs/API.md`, `docs/YMS.md`. Приложенный к задаче Markdown в сессию не
пришёл — где он может расходиться с кодом, это отмечено.

Принцип: клиент не придумывает API. Всё, что ниже помечено «нет в коде», в
приложении не реализуется до получения документации.

## 1. Адреса

| Сервис | Адрес | Авторизация |
|---|---|---|
| WMS | `https://wms.scada25.ru` (так же канонизирует сам backend в `scada-id/start`; OpenAPI называет `https://scada25.ru`) | `Authorization: Bearer <accessToken>` |
| ТСД (те же маршруты WMS) | тот же хост | `X-Device-Token: <deviceToken>` (или `Authorization: Device …`) |
| YMS | `https://yms.scadasystem.io` | cookie `wms_session` на домене YMS |
| VEKAS | публичный адаптер WMS `/api/wms/vekas/…` | как WMS |
| GSMT decode | `scada25.ru/decode`, `/decode-and-annotate` — **нет в коде этого репозитория** (сервис GSMT) | — |

Адреса переопределяются при сборке: `-Pscada.wmsUrl=… -Pscada.ymsUrl=…`.

## 2. Вход WMS

`POST /api/auth/login` `{"login","password"}` — `login` не обязан быть e-mail.

```json
{ "ok": true, "accessToken": "…", "tokenType": "Bearer", "expiresIn": 86400,
  "user": { "userId": "7", "login": "…", "fio": "…", "position": "…", "roleCodes": ["warehouse_operator"] } }
```

* `roleCodes` лежат **внутри `user`**. У «старых» учётных записей (legacy fallback)
  `userId` и `roleCodes` отсутствуют.
* Ошибки: 400 `{error}` (пустые поля), 401 `{error:"Неверный логин или пароль"}`.
* Токен — HMAC-подписанный JSON, срок 24 ч. **Серверного отзыва нет**: `POST /api/auth/logout`
  только гасит cookie. Выход в приложении = удаление токена из хранилища.
* `GET /api/auth/me` → `{user}` или 401 `{user:null}`.
* Восстановления пароля в API нет → ссылка на экране входа не показывается.
* Scada ID (OIDC, `/api/auth/scada-id/*`) существует, но redirect и cookie привязаны к
  веб-домену — для нативного клиента механизм не предназначен, кнопки SSO нет.

## 3. Устройство (ТСД)

`POST /api/wms/devices/enroll` — публичный, код одноразовый и короткоживущий.

Запрос: `{code, deviceUid?, deviceName?, platform="android", appVersion?, deviceInfo?}`.
Ответ: `{ok, device, deviceUid, deviceName, deviceToken, siteCode}`.

* Если `deviceUid` не передан, сервер выдаёт `TSD-XXXXXX`.
* При сбое чтения площадки `siteCode` = литерал `"DEFAULT"`. Сервер сам считает
  `default`/пусто основной площадкой (`lib/wms/site-code.ts`, `WMS_SITE_CODE`, по умолчанию
  `skeet`) — приложение сохраняет **канонический** код (`SiteCode.canonical`).
* Отзыв устройства — в веб-WMS («Терминалы»); в приложении «Отключить» удаляет токен локально.

## 4. Задания ТСД

`GET /api/wms/devices/tasks?siteCode&deviceUid[&operatorUserId&status&type&query&cursor&limit]`
→ `{device, tasks[], nextCursor}`.

* Без `status` — «входящие»: `open, claimed, in_progress, on_hold, exception`.
* Сервер фильтрует задания по ролям оператора (назначенного устройству или `operatorUserId`).
* Поля задания: `taskId, taskCode, taskType, taskStatus, priorityCode (low|normal|high|urgent),
  plannedQty, confirmedQty, dueAt, itemCode, itemName, lotCode, sourceLocationCode,
  targetLocationCode, source/targetWarehouseCode|Name, documentNo, taskPayload, …`

Мутации `POST /api/wms/devices/tasks/{id}/(claim|start|complete|exception)`:
`{requestId (UUID), siteCode, deviceUid, operatorUserId?, …}`; `complete` дополнительно
`confirmedQty, sourceLocationCode, targetLocationCode, note`; `exception` — `exceptionCode, exceptionNote`.

* Идемпотентность `runIdempotentWrite`: повтор с тем же `requestId` → `disposition: "duplicate"`.
  Ответ `{…, disposition: applied|duplicate|conflict|failed}`; ошибки `{error, code, disposition:"failed"}`.
* Коды: `wrong_device` (409), `device_inactive` (409), `bad_task_status` (409), `forbidden_task_type` (403), `no_roles` (403).
* Приложение **не** повторяет POST автоматически; повтор — только пользователем и с тем же `requestId`.
  Этап задания считается выполненным только после ответа `applied`/`duplicate`.

## 5. Роли

Перенесено в `core/common/Roles.kt` из:

* `lib/mobile-permissions.ts` — разделы ТСД: `tasks` (admin, warehouse_manager, warehouse_operator,
  line_operator), `revision` (+auditor, без line_operator), `receiving`, `issue`, `production`, `virtualWarehouse`.
  Пользователь **без ролей** видит всё, кроме заданий и ревизии (поведение основного WMS).
* `lib/wms/device-operator-auth.ts` — тип `revision` только для ролей ревизии.
* `lib/wms/yms/permissions.ts` — `yms.read / visit.write / assign / gate.confirm / warehouse.confirm / yard.write`
  для admin, warehouse_manager, warehouse_operator, auditor, yms_dispatcher, yms_guard, yms_logist, yms_warehouse.

Права окончательно проверяет backend; меню лишь не показывает заведомо недоступное.

## 6. YMS

`POST /api/auth/login` (yms-app) `{login,password}` → `{ok, user:{login,fio}}` + `Set-Cookie: wms_session`.
**accessToken в ответе нет.** `GET /api/auth/me` → `{login, fio, position}` (без ролей — роли берутся
из WMS-сессии того же `wms_users`). `POST /api/auth/logout`.

Единого входа нет: приложение держит отдельный cookie-клиент (`YmsApiClient`), cookie
шифруются на устройстве, Bearer WMS в YMS не отправляется.

API: `/api/yms/visits`, `/visits/{id}` (+ `/transition`, `/scan`, `/driver`, `/job`, `/discrepancy`,
`/equipment`), `/board`, `/yard`, `/fleet`, `/jobs/{id}`, `/orders` — этап 5.

## 7. Сканирование и GS1

Backend сам нормализует артефакты сканеров (`lib/wms/crpt.ts`: `~`, `{GS}`, `␝`, `(91)` → GS)
и **не отрезает криптохвост** 91/92/93. Поэтому клиент:

* отправляет строку **как считал декодер**, с настоящим `GS` (0x1D);
* разбирает GS1 (`core/common/Gs1.kt`) только для показа;
* при отсутствии разделителей не угадывает длину серийного номера.

## 8. Этапы 4–6 (маршруты есть, тела уточняются по `lib/` при реализации)

| Раздел | Маршруты |
|---|---|
| Поиск | `GET/POST /api/wms/lookup` (`q`/`query`, `siteCode`) |
| Приёмка | `POST /receiving/resolve-scan` (`code, siteCode, productGroup, receivingCategory`), `GET /receiving/operator-feed` (`documentId, siteCode, limit, scanLimit, scanOffset`), `GET /receiving/batch`, `POST /receiving/batch/place`, `POST /receiving/finalize` (`documentId, siteCode, deviceUid, targetLocationCode, lineTargets, confirmExpired`) |
| Готовая продукция | `/api/wms/warehouse/finished-goods/` `summary, rows, rows/{rowId}/pallets, pallets?query, lookup?code, nomenclature/…, plan-*` |
| VEKAS | `GET /api/wms/vekas/batches`, `/batches/{batchId}`, `/batches/{batchId}/pallets`, `/batches/{batchId}/codes` |
| Остатки | `GET /api/wms/stock/availability`, `/stock/item-locations` |
| QPass | только `GET /api/wms/qpass/lookup` — собственного API QPass в контракте нет |

**Нет в коде:** VEKAS `hierarchy-summary` (из ТЗ) и форматы GSMT `/decode`. До получения
документации приложение их не вызывает.

## 9. Обновления

Сервер обновлений (`/api/v1/**`, `/packages/**`) обслуживает ТСД `com.scadatable.wms`.
SCADA Mobile — `com.scadatable.mobile` со своим `versionCode`; APK ТСД ему не подходит.
До отдельного канала приложение показывает только локальную версию.
