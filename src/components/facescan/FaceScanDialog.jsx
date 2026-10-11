import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, CameraOff, Loader2, X } from 'lucide-react'
import { loadFaceEngine } from '@/lib/faceEngine'

const DETECT_INTERVAL_MS = 240
const MIN_FACE_RATIO = 0.16
const MIN_FACE_LUMA = 52
const STABLE_DISTANCE = 0.32

export function FaceScanDialog({ open, onClose, onCaptured, title = 'AI Face Scan', children }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const busyRef = useRef(false)
  const lastDescriptorRef = useRef(null)
  const aliveRef = useRef(false)
  const engineRef = useRef(null)

  const [phase, setPhase] = useState('idle')
  const [hint, setHint] = useState('Position your face inside the frame.')
  const [cameraError, setCameraError] = useState(null)
  const [modelError, setModelError] = useState(null)

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) {
        try { track.stop() } catch {}
      }
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    aliveRef.current = open
    if (!open) stopCamera()
    return () => {
      aliveRef.current = false
      stopCamera()
    }
  }, [open, stopCamera])

  const close = useCallback(() => {
    stopCamera()
    onClose?.()
  }, [stopCamera, onClose])

  const measureLuma = (box) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return 255
    const w = 32
    const h = 32
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    return sum / (data.length / 4)
  }

  const distance = (a, b) => {
    let sum = 0
    for (let i = 0; i < a.length; i += 1) {
      const d = a[i] - b[i]
      sum += d * d
    }
    return Math.sqrt(sum)
  }

  const finish = (descriptor) => {
    stopCamera()
    lastDescriptorRef.current = null
    setPhase('captured')
    setHint('Face captured.')
    window.setTimeout(() => {
      if (aliveRef.current) onCaptured?.(Array.from(descriptor))
    }, 450)
  }

  const scanTick = async () => {
    const video = videoRef.current
    const faceapi = engineRef.current
    if (busyRef.current || !video || video.readyState < 2 || !faceapi) return

    busyRef.current = true
    try {
      const results = await faceapi
        .detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 })
        )
        .withFaceLandmarks()
        .withFaceDescriptors()

      if (!aliveRef.current) return

      if (results.length === 0) {
        lastDescriptorRef.current = null
        setHint('Move your face into the frame.')
        return
      }
      if (results.length > 1) {
        lastDescriptorRef.current = null
        setHint('Please make sure only one face is visible.')
        return
      }

      const face = results[0]
      const box = face.detection.box
      if (box.width < video.clientWidth * MIN_FACE_RATIO) {
        lastDescriptorRef.current = null
        setHint('Move a little closer.')
        return
      }
      if (measureLuma(box) < MIN_FACE_LUMA) {
        lastDescriptorRef.current = null
        setHint('Move to a better-lit area.')
        return
      }

      const descriptor = face.descriptor
      const previous = lastDescriptorRef.current
      if (previous && distance(previous, descriptor) < STABLE_DISTANCE) {
        finish(descriptor)
        return
      }
      lastDescriptorRef.current = Array.from(descriptor)
      setHint('Hold still.')
    } catch {
      if (aliveRef.current) setHint('Position your face inside the frame.')
    } finally {
      busyRef.current = false
    }
  }

  const start = async () => {
    setCameraError(null)
    setModelError(null)
    lastDescriptorRef.current = null
    engineRef.current = null
    setPhase('camera')
    setHint('Starting the camera…')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser does not support camera scanning. Try Chrome or Safari.')
      setPhase('idle')
      return
    }

    // Camera starts BEFORE the face model. This prevents model download time
    // from blocking the live preview on phones and laptops.
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      })

      if (!aliveRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        await video.play().catch(() => {})
      }

      setHint('Camera ready. Preparing face scan…')
    } catch (error) {
      setCameraError(friendlyCameraError(error))
      setPhase('idle')
      return
    }

    // Only after the preview is visible do we load the face model.
    try {
      engineRef.current = await loadFaceEngine()
    } catch {
      stopCamera()
      setModelError('The face scan could not load on this device. Check your connection and try again.')
      setPhase('idle')
      return
    }

    if (!aliveRef.current || !streamRef.current) return

    setPhase('scanning')
    setHint('Position your face inside the frame.')
    timerRef.current = window.setInterval(scanTick, DETECT_INTERVAL_MS)
    scanTick()
  }

  if (!open) return null

  if (children) {
    return (
      <AnimatePresence>
        <motion.div className="mp-fs" role="dialog" aria-modal="true" aria-label={title}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <div className="mp-fs__card">
            <div className="mp-fs__head">
              <div><p className="mp-fs__eyebrow">Markipie AI</p><h2 className="mp-fs__title">{title}</h2></div>
              <button type="button" className="mp-fs__close" onClick={close} aria-label="Close face scan">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="mp-fs__step">{children}</div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      <motion.div className="mp-fs" role="dialog" aria-modal="true" aria-label={title}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <div className="mp-fs__card">
          <div className="mp-fs__head">
            <div><p className="mp-fs__eyebrow">Markipie AI</p><h2 className="mp-fs__title">{title}</h2></div>
            <button type="button" className="mp-fs__close" onClick={close} aria-label="Close face scan">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {phase === 'idle' ? (
            <div className="mp-fs__start">
              <span className="mp-fs__orb" aria-hidden="true"><Camera size={26} aria-hidden="true" /></span>
              <p className="mp-fs__lead">Use the camera to find your photos. Nothing is photographed or saved.</p>
              {cameraError ? <p className="mp-fs__error" role="alert"><CameraOff size={14} aria-hidden="true" /> {cameraError}</p> : null}
              {modelError ? <p className="mp-fs__error" role="alert">{modelError}</p> : null}
              <button type="button" className="mp-fs__primary" onClick={start}>
                <Camera size={16} aria-hidden="true" /> Start Camera
              </button>
              <p className="mp-fs__privacy">Your camera is used only to find matching photos. Your camera image is not uploaded as a gallery photo.</p>
            </div>
          ) : (
            <div className="mp-fs__stage">
              <div className="mp-fs__frame">
                <video ref={videoRef} className="mp-fs__video" autoPlay playsInline muted aria-label="Camera preview" />
                <canvas ref={canvasRef} className="mp-fs__sample" aria-hidden="true" />
                {phase === 'scanning' ? (
                  <motion.div className="mp-fs__guide" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }} aria-hidden="true">
                    <span className="mp-fs__corner mp-fs__corner--tl" />
                    <span className="mp-fs__corner mp-fs__corner--tr" />
                    <span className="mp-fs__corner mp-fs__corner--bl" />
                    <span className="mp-fs__corner mp-fs__corner--br" />
                    <motion.span className="mp-fs__line" animate={{ top: ['8%', '88%', '8%'] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />
                  </motion.div>
                ) : null}
                {phase === 'captured' ? (
                  <motion.div className="mp-fs__done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} aria-hidden="true">
                    <Loader2 size={18} className="mp-fs__spin" />
                  </motion.div>
                ) : null}
                {phase === 'camera' ? (
                  <div className="mp-fs__veil" aria-hidden="true"><Loader2 size={20} className="mp-fs__spin" /></div>
                ) : null}
              </div>
              <p className="mp-fs__hint" role="status" aria-live="polite">
                {phase === 'captured' ? 'Finding your photos.' : hint}
              </p>
              <div className="mp-fs__foot">
                <p className="mp-fs__privacy">Your camera is used only to find matching photos. Your camera image is not uploaded as a gallery photo.</p>
                <button type="button" className="mp-fs__stop" onClick={close}>Stop Camera</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function friendlyCameraError(error) {
  const name = error?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera access in your browser settings and try again.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is being used by another application. Close it and try again.'
  }
  if (name === 'OverconstrainedError') {
    return 'This camera is not supported for face scanning.'
  }
  return 'The camera could not be started. Try reloading the page.'
}
