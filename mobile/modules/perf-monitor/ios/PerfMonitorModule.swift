import ExpoModulesCore
import QuartzCore
import Darwin

/// Counts CADisplayLink callbacks (one per rendered frame on the main/UI thread) in 1 s windows.
final class FrameCounter: NSObject {
  private var link: CADisplayLink?
  private var frames = 0
  private var windowStart: CFTimeInterval = 0
  private(set) var lastFps: Double = 0

  func start() {
    guard link == nil else { return }
    frames = 0
    windowStart = CACurrentMediaTime()
    let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
    // Allow the full ProMotion range so 120 Hz devices are not reported as 60.
    link.preferredFrameRateRange = CAFrameRateRange(minimum: 1, maximum: 120, preferred: 120)
    link.add(to: .main, forMode: .common)
    self.link = link
  }

  func stop() {
    link?.invalidate()
    link = nil
    lastFps = 0
  }

  @objc private func tick(_ link: CADisplayLink) {
    frames += 1
    let elapsed = link.timestamp - windowStart
    if elapsed >= 1.0 {
      lastFps = Double(frames) / elapsed
      frames = 0
      windowStart = link.timestamp
    }
  }
}

public class PerfMonitorModule: Module {
  private let counter = FrameCounter()

  public func definition() -> ModuleDefinition {
    Name("PerfMonitor")

    /// The process's physical footprint: the number Xcode's memory gauge and jetsam use.
    Function("getMemoryFootprintBytes") { () -> Double in
      var info = task_vm_info_data_t()
      var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
      let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
          task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
        }
      }
      return result == KERN_SUCCESS ? Double(info.phys_footprint) : -1
    }

    Function("startFrameMonitor") {
      DispatchQueue.main.async { self.counter.start() }
    }

    Function("stopFrameMonitor") {
      DispatchQueue.main.async { self.counter.stop() }
    }

    Function("getUiFrameRate") { () -> Double in
      self.counter.lastFps
    }

    /// Not measured natively on iOS: requestAnimationFrame is driven by the display link there, so
    /// the JS side counts rAF callbacks. -1 means "use the JS measurement".
    Function("getJsFrameRate") { () -> Double in
      -1
    }

    OnDestroy {
      DispatchQueue.main.async { self.counter.stop() }
    }
  }
}
