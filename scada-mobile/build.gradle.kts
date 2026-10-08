// All Gradle plugins live on the root classpath so the Kotlin plugin and the
// Android Gradle Plugin share one classloader. AGP, Hilt and KSP are added only
// for the full Android build (they come from Google Maven).
buildscript {
    val jvmOnly = gradle.startParameter.projectProperties.containsKey("scada.jvmOnly")
    repositories {
        google {
            content {
                includeGroupByRegex("androidx\\..*")
                includeGroupByRegex("com\\.android(\\..*)?")
                includeGroupByRegex("com\\.google\\.android\\..*")
                includeGroupByRegex("com\\.google\\.mlkit(\\..*)?")
                includeGroupByRegex("com\\.google\\.firebase(\\..*)?")
                includeGroupByRegex("com\\.google\\.testing\\.platform")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21")
        classpath("org.jetbrains.kotlin:kotlin-serialization:2.0.21")
        classpath("org.jetbrains.kotlin:compose-compiler-gradle-plugin:2.0.21")
        if (!jvmOnly) {
            classpath("com.android.tools.build:gradle:8.7.3")
            classpath("com.google.dagger:hilt-android-gradle-plugin:2.52")
            classpath("com.google.devtools.ksp:symbol-processing-gradle-plugin:2.0.21-1.0.28")
        }
    }
}
