package com.geobrilo

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
      // The `standalone` build type embeds the JS bundle into the APK (see
      // android/app/build.gradle) specifically so it doesn't need a live Metro
      // connection -- useDevSupport must be false there to actually use that
      // embedded bundle instead of trying to reach the dev server.
      useDevSupport = !BuildConfig.STANDALONE,
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
