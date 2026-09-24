package expo.modules.perfmonitor

import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Counts Choreographer frame callbacks (UI-thread vsync-driven frames) in 1 s windows. */
private class FrameCounter : Choreographer.FrameCallback {
  private var running = false
  private var frames = 0
  private var windowStartNanos = 0L

  @Volatile
  var lastFps = 0.0
    private set

  fun start() {
    if (running) return
    running = true
    frames = 0
    windowStartNanos = 0L
    Choreographer.getInstance().postFrameCallback(this)
  }

  fun stop() {
    running = false
    Choreographer.getInstance().removeFrameCallback(this)
    lastFps = 0.0
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (!running) return
    if (windowStartNanos == 0L) windowStartNanos = frameTimeNanos
    frames++
    val elapsed = frameTimeNanos - windowStartNanos
    if (elapsed >= 1_000_000_000L) {
      lastFps = frames * 1_000_000_000.0 / elapsed
      frames = 0
      windowStartNanos = frameTimeNanos
    }
    Choreographer.getInstance().postFrameCallback(this)
  }
}

class PerfMonitorModule : Module() {
  private val counter = FrameCounter()
  private val main = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("PerfMonitor")

    /** Total proportional set size (PSS) of this process: its share of physical memory, in bytes. */
    Function("getMemoryFootprintBytes") {
      val info = Debug.MemoryInfo()
      Debug.getMemoryInfo(info)
      info.totalPss.toDouble() * 1024.0
    }

    // Choreographer callbacks must be registered on the main (UI) thread.
    Function("startFrameMonitor") {
      main.post { counter.start() }
    }

    Function("stopFrameMonitor") {
      main.post { counter.stop() }
    }

    Function("getUiFrameRate") {
      counter.lastFps
    }

    OnDestroy {
      main.post { counter.stop() }
    }
  }
}
