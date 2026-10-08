# kotlinx.serialization: keep generated serializers of the network contracts
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class ru.scada.mobile.** { *** Companion; }
-keepclasseswithmembers class ru.scada.mobile.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class ru.scada.mobile.**$$serializer { *; }
# Retrofit service interfaces
-keep,allowobfuscation interface ru.scada.mobile.core.network.** { *; }
-keepattributes Signature, Exceptions
