import AVFoundation
import Foundation

@objc(AudioPlayerModule)
class AudioPlayerModule: NSObject {
  private var player: AVAudioPlayer?

  @objc func startAudio() {
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options:
        [.mixWithOthers])
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      print("AudioSession error: \(error)")
    }

    if let existing = player {
      existing.play()
      return
    }

    guard let url = Bundle.main.url(forResource: "aquariumBg", withExtension: "m4a") else {
      print("aquariumBg.m4a not found in bundle")
      return
    }

    do {
      let p = try AVAudioPlayer(contentsOf: url)
      p.numberOfLoops = -1
      p.volume = 1.0
      p.prepareToPlay()
      p.play()
      player = p
    } catch {
      print("AVAudioPlayer error: \(error)")
    }
  }

  @objc func pauseAudio() {
    player?.pause()
    do {
      try AVAudioSession.sharedInstance().setCategory(.ambient)
      try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    } catch {
      print("AudioSession error: \(error)")
    }
  }

  @objc func stopAudio() {
    player?.stop()
    player = nil
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }
}
