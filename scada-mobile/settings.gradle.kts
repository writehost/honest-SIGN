// SCADA Mobile — native Android client of the SCADA System ecosystem.
//
// `-Pscada.jvmOnly` builds only the pure Kotlin/JVM modules (contracts, networking,
// roles, GS1). They need nothing from Google Maven, so they can be compiled and
// tested anywhere; the Android modules are added on a normal build.

pluginManagement {
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
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
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
    }
}

rootProject.name = "scada-mobile"

val jvmOnly = providers.gradleProperty("scada.jvmOnly").isPresent

// Pure Kotlin modules
include(":core:common")
include(":core:network")
include(":core:data")

if (!jvmOnly) {
    include(":app")
    include(":core:designsystem")
    include(":core:security")
    include(":feature:login")
    include(":feature:home")
}
