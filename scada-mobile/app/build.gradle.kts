plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
}

android {
    namespace = "ru.scada.mobile"
    compileSdk = 35

    defaultConfig {
        // Собственный package — не com.scadatable.wms (ТСД): свой versionCode и свой канал обновлений.
        applicationId = "com.scadatable.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        // Адреса сервисов можно переопределить: ./gradlew assembleDebug -Pscada.wmsUrl=https://…/
        buildConfigField("String", "WMS_BASE_URL", "\"${project.findProperty("scada.wmsUrl") ?: "https://wms.scada25.ru/"}\"")
        buildConfigField("String", "YMS_BASE_URL", "\"${project.findProperty("scada.ymsUrl") ?: "https://yms.scadasystem.io/"}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging { resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" } }
    testOptions {
        unitTests.isIncludeAndroidResources = true
        unitTests.all { it.systemProperty("robolectric.pixelCopyRenderMode", "hardware"); it.systemProperty("roborazzi.test.record", "true"); it.systemProperty("screenshots.dir", rootProject.layout.projectDirectory.dir("docs/screens").asFile.absolutePath) }
    }
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:security"))
    implementation(project(":core:data"))
    implementation(project(":feature:login"))
    implementation(project(":feature:home"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.roborazzi)
    testImplementation(libs.roborazzi.compose)
    testImplementation(platform(libs.compose.bom))
    testImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}

// Скриншот-тесты экранов используют debug-манифест Compose — release-вариант их не запускает.
androidComponents {
    beforeVariants(selector().withBuildType("release")) {
        (it as com.android.build.api.variant.HasUnitTestBuilder).enableUnitTest = false
    }
}
