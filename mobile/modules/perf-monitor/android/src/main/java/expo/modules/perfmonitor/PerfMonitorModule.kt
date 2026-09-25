package expo.modules.perfmonitor

import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.view.Choreographer
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.queue.MessageQueueThread
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Counts Choreographer frame callbacks (UI-thread vsync-driven frames) in 1 s windows, and how
 * many of those frames the JS thread was free to serve.
 *
 * JS frames are measured with a probe rather than by counting requestAnimationFrame callbacks:
 * React Native on Android only fires a rAF callback on a frame whose vsync timestamp is later than
 * the callback's registration, so when frame callbacks run late relative to their timestamps (as
 * on the emulator) rAF lands on every other vsync and reads ~30 while the JS thread is idle. Each
 * frame, one probe is posted to the JS queue; the frame counts if the JS thread runs it within one
 * frame interval. A busy JS thread delays the probe and lowers the count.
 */
private class FrameCounter : Choreographer.FrameCallback {
  private var running = false
  private var frames = 0
  private var windowStartNanos = 0L
  private var lastFrameNanos = 0L
  private var frameIntervalNanos = DEFAULT_FRAME_NANOS
  private val jsFrames = AtomicInteger(0)
  private val probePending = AtomicBoolean(false)

  /** The JS thread's queue, or null when it isn't available (then JS readings are unavailable). */
  var jsQueue: MessageQueueThread? = null

  @Volatile
  var lastFps = 0.0
    private set

  /** JS frames per second over the last window; NO_WINDOW until one completes, -1 without a JS queue. */
  @Volatile
  var lastJsFps = NOT_MEASURED
    private set

  fun start() {
    if (running) return
    running = true
    frames = 0
    windowStartNanos = 0L
    lastFrameNanos = 0L
    frameIntervalNanos = DEFAULT_FRAME_NANOS
    jsFrames.set(0)
    // A probe dropped during a previous run's teardown must not block this run's probes.
    probePending.set(false)
    lastJsFps = if (jsQueue == null) NOT_MEASURED else NO_WINDOW
    Choreographer.getInstance().postFrameCallback(this)
  }

  fun stop() {
    running = false
    Choreographer.getInstance().removeFrameCallback(this)
    lastFps = 0.0
    lastJsFps = if (jsQueue == null) NOT_MEASURED else NO_WINDOW
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (!running) return
    Choreographer.getInstance().postFrameCallback(this)
    if (windowStartNanos == 0L) {
      // The first callback only opens the window: counting it too gave N + 1 frames per N
      // intervals (61 FPS on a 60 Hz display in the first window).
      windowStartNanos = frameTimeNanos
      jsFrames.set(0)
      probeJs(frameTimeNanos)
      return
    }
    probeJs(frameTimeNanos)
    frames++
    val elapsed = frameTimeNanos - windowStartNanos
    if (elapsed >= 1_000_000_000L) {
      lastFps = frames * 1_000_000_000.0 / elapsed
      if (jsQueue != null) lastJsFps = jsFrames.getAndSet(0) * 1_000_000_000.0 / elapsed
      frames = 0
      windowStartNanos = frameTimeNanos
    }
  }

  private fun probeJs(frameTimeNanos: Long) {
    val queue = jsQueue ?: return
    // The deadline is the display's frame period: the shortest interval seen, so a dropped UI frame
    // (a 33 ms gap) doesn't loosen it.
    if (lastFrameNanos != 0L) {
      val delta = frameTimeNanos - lastFrameNanos
      if (delta in MIN_FRAME_NANOS until frameIntervalNanos) frameIntervalNanos = delta
    }
    lastFrameNanos = frameTimeNanos
    val interval = frameIntervalNanos
    // One probe in flight at most: while the JS thread is busy, the frames it misses aren't counted.
    if (!probePending.compareAndSet(false, true)) return
    val posted = System.nanoTime()
    val queued = queue.runOnQueue {
      if (System.nanoTime() - posted <= interval) jsFrames.incrementAndGet()
      probePending.set(false)
    }
    if (!queued) probePending.set(false)
  }

  private companion object {
    const val DEFAULT_FRAME_NANOS = 16_666_667L
    const val MIN_FRAME_NANOS = 4_000_000L
    const val NOT_MEASURED = -1.0
    const val NO_WINDOW = -2.0
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
      val queue = (appContext.reactContext as? ReactContext)?.getJSMessageQueueThread()
      main.post {
        counter.jsQueue = queue
        counter.start()
      }
    }

    Function("stopFrameMonitor") {
      main.post { counter.stop() }
    }

    Function("getUiFrameRate") {
      counter.lastFps
    }

    Function("getJsFrameRate") {
      counter.lastJsFps
    }

    OnDestroy {
      main.post { counter.stop() }
    }
  }
}
