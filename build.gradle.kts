import groovy.json.JsonSlurper
import java.util.Properties

plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    id("com.google.dagger.hilt.android") version "2.48.1" apply false
    id("com.google.devtools.ksp") version "1.9.22-1.0.17" apply false
    id("com.google.gms.google-services") version "4.4.0" apply false
}

// Version management tasks
tasks.register("syncVersion") {
    group = "version"
    description = "Sync Android version from package.json"

    doLast {
        val packageJsonFile = file("package.json")
        if (!packageJsonFile.exists()) {
            throw GradleException("package.json not found")
        }

        val json = JsonSlurper().parse(packageJsonFile) as Map<String, Any>
        val version = json["version"] as String

        val appBuildFile = file("app/build.gradle.kts")
        var buildContent = appBuildFile.readText()

        // Extract current versionCode
        val versionCodeRegex = """versionCode = (\d+)""".toRegex()
        val versionCodeMatch = versionCodeRegex.find(buildContent)
        val currentVersionCode = versionCodeMatch?.groupValues?.get(1)?.toIntOrNull() ?: 1

        // Update versionName and increment versionCode
        buildContent = buildContent.replace(
            """versionName = "[\d.]+"""".toRegex(),
            """versionName = "$version""""
        )
        buildContent = buildContent.replace(
            """versionCode = \d+""".toRegex(),
            "versionCode = ${currentVersionCode + 1}"
        )

        appBuildFile.writeText(buildContent)

        println("✅ Synced version: $version (versionCode: ${currentVersionCode + 1})")
    }
}

tasks.register("setVersion") {
    group = "version"
    description = "Set specific version (e.g., ./gradlew setVersion -Pversion=1.2.3)"

    doLast {
        val newVersion = project.property("version") as String
        if (newVersion.isBlank()) {
            throw GradleException("Version not specified. Use -Pversion=1.2.3")
        }

        val appBuildFile = file("app/build.gradle.kts")
        var buildContent = appBuildFile.readText()

        // Extract current versionCode
        val versionCodeRegex = """versionCode = (\d+)""".toRegex()
        val versionCodeMatch = versionCodeRegex.find(buildContent)
        val currentVersionCode = versionCodeMatch?.groupValues?.get(1)?.toIntOrNull() ?: 1

        // Update versionName and increment versionCode
        buildContent = buildContent.replace(
            """versionName = "[\d.]+"""".toRegex(),
            """versionName = "$newVersion""""
        )
        buildContent = buildContent.replace(
            """versionCode = \d+""".toRegex(),
            "versionCode = ${currentVersionCode + 1}"
        )

        appBuildFile.writeText(buildContent)

        // Also update package.json
        val packageJsonFile = file("package.json")
        var packageContent = packageJsonFile.readText()
        packageContent = packageContent.replace(
            """"version": "[\d.]+"""".toRegex(),
            """ "version": "$newVersion""""
        )
        packageJsonFile.writeText(packageContent)

        println("✅ Set version to: $newVersion (versionCode: ${currentVersionCode + 1})")
    }
}

tasks.register("bumpVersion") {
    group = "version"
    description = "Bump patch version (e.g., ./gradlew bumpVersion)"
    dependsOn("setVersion")
    doFirst {
        val packageJsonFile = file("package.json")
        val json = JsonSlurper().parse(packageJsonFile) as Map<String, Any>
        val currentVersion = json["version"] as String
        val parts = currentVersion.split(".")
        if (parts.size != 3) throw GradleException("Invalid version format: $currentVersion")
        val newPatch = parts[2].toInt() + 1
        val newVersion = "${parts[0]}.${parts[1]}.$newPatch"
        project.extensions.extraProperties.set("version", newVersion)
    }
}

tasks.register("bumpMinor") {
    group = "version"
    description = "Bump minor version"
    dependsOn("setVersion")
    doFirst {
        val packageJsonFile = file("package.json")
        val json = JsonSlurper().parse(packageJsonFile) as Map<String, Any>
        val currentVersion = json["version"] as String
        val parts = currentVersion.split(".")
        if (parts.size != 3) throw GradleException("Invalid version format: $currentVersion")
        val newMinor = parts[1].toInt() + 1
        val newVersion = "${parts[0]}.$newMinor.0"
        project.extensions.extraProperties.set("version", newVersion)
    }
}

tasks.register("bumpMajor") {
    group = "version"
    description = "Bump major version"
    dependsOn("setVersion")
    doFirst {
        val packageJsonFile = file("package.json")
        val json = JsonSlurper().parse(packageJsonFile) as Map<String, Any>
        val currentVersion = json["version"] as String
        val parts = currentVersion.split(".")
        if (parts.size != 3) throw GradleException("Invalid version format: $currentVersion")
        val newMajor = parts[0].toInt() + 1
        val newVersion = "$newMajor.0.0"
        project.extensions.extraProperties.set("version", newVersion)
    }
}
