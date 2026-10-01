import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  Pause,
  Play,
  ThumbsDown,
  ThumbsUp,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { Watermark } from '@/components/gallery/Watermark'
import { eventPermissions } from '@/lib/eventPermissions'
import { mediaDownloadSrc, mediaSrc } from '@/lib/drive'
import { supabase } from '@/lib/supabase'

const SWIPE_THRESHOLD = 48

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * Full screen media viewer for the client gallery: photos and videos open
 * inside the Markipie site, never on Google Drive. Keyboard arrows,
 * swipe, counter, watermark, download and reactions all respect the
 * event's permission flags.
 */
export function MediaViewer({
  items,
  index,
  total,
  code,
  event,
  sessionId,
  onClose,
  onIndexChange,
  onNearEnd,
  onReaction,
}) {
  const item = items[index]
  const closeRef = useRef(null)
  const touchRef = useRef(null)
  const stageRef = useRef(null)
  const [reaction, setReaction] = useState(null)
  const permissions = eventPermissions(event)

  // Reset per item state when the viewer moves to another media item.
  useEffect(() => {
    setReaction(item?.my_reaction ?? null)
  }, [item?.id, item?.my_reaction])

  const go = useCallback(
    (delta) => {
      const next = Math.min(Math.max(index + delta, 0), items.length - 1)
      if (next !== index) {
        onIndexChange(next)
        if (onNearEnd && next >= items.length - 3) {
          onNearEnd()
        }
      }
    },
    [index, items.length, onIndexChange, onNearEnd]
  )

  useEffect(() => {
    closeRef.current?.focus()

    const onKey = (keyEvent) => {
      if (keyEvent.key === 'Escape') {
        onClose()
      } else if (keyEvent.key === 'ArrowRight') {
        go(1)
      } else if (keyEvent.key === 'ArrowLeft') {
        go(-1)
      }
    }
    document.addEventListener('keydown', onKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [go, onClose])

  const react = async (next) => {
    if (!item) {
      return
    }
    const target = reaction === next ? null : next
    setReaction(target)
    onReaction?.(item.id, target)
    try {
      await supabase.rpc('set_reaction', {
        p_code: code,
        p_media_id: item.id,
        p_session_id: sessionId,
        p_reaction: target,
      })
    } catch {
      // A failed reaction is not worth interrupting viewing for.
    }
  }

  const togglePhotoFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      stageRef.current?.requestFullscreen?.()?.catch?.(() => {})
    }
  }

  const onTouchStart = (touchEvent) => {
    touchRef.current = { x: touchEvent.touches[0].clientX, y: touchEvent.touches[0].clientY }
  }

  const onTouchEnd = (touchEvent) => {
    if (!touchRef.current) {
      return
    }
    const dx = touchEvent.changedTouches[0].clientX - touchRef.current.x
    const dy = touchEvent.changedTouches[0].clientY - touchRef.current.y
    touchRef.current = null
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1)
    }
  }

  if (!item) {
    return null
  }

  const canDownload = permissions.download
  const canReact = permissions.reactions
  const showWatermark = permissions.watermark

  return (
    <div className="mp-viewer" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="mp-viewer__top">
        <p className="mp-viewer__counter">
          {index + 1} / {Math.max(total, items.length)}
        </p>
        <div className="mp-viewer__actions">
          {canDownload ? (
            <a
              className="mp-viewer__btn"
              href={mediaDownloadSrc(item.id, code)}
              download={(item.file_name ?? 'markipie').replace(/[^\w.\-]+/g, '_')}
              aria-label="Download this media"
            >
              <Download size={16} aria-hidden="true" />
              <span>Download</span>
            </a>
          ) : null}
          {item.file_type !== 'video' ? (
            <button
              type="button"
              className="mp-viewer__btn"
              onClick={togglePhotoFullscreen}
              aria-label="View fullscreen"
            >
              <Maximize size={16} aria-hidden="true" />
            </button>
          ) : null}
          <button ref={closeRef} type="button" className="mp-viewer__btn" onClick={onClose} aria-label="Close viewer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="mp-viewer__stage"
        ref={stageRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button type="button" className="mp-viewer__nav mp-viewer__nav--prev" onClick={() => go(-1)} aria-label="Previous media" disabled={index === 0}>
          <ChevronLeft size={26} aria-hidden="true" />
        </button>

        {item.file_type === 'video' ? (
          <VideoStage src={mediaSrc(item.id, code, 'full')} fileName={item.file_name} watermark={showWatermark} />
        ) : (
          <figure className="mp-viewer__photo">
            <img src={mediaSrc(item.id, code, 'full')} alt={item.file_name ?? 'Photo'} />
            {showWatermark ? <Watermark /> : null}
          </figure>
        )}

        <button
          type="button"
          className="mp-viewer__nav mp-viewer__nav--next"
          onClick={() => go(1)}
          aria-label="Next media"
          disabled={index === items.length - 1 && items.length >= total}
        >
          <ChevronRight size={26} aria-hidden="true" />
        </button>
      </div>

      {canReact ? (
        <div className="mp-viewer__reactions">
          <button
            type="button"
            className={`mp-viewer__react${reaction === 'like' ? ' is-active' : ''}`}
            onClick={() => react('like')}
            aria-pressed={reaction === 'like'}
            aria-label="Like this photo"
          >
            <ThumbsUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`mp-viewer__react mp-viewer__react--down${reaction === 'dislike' ? ' is-active' : ''}`}
            onClick={() => react('dislike')}
            aria-pressed={reaction === 'dislike'}
            aria-label="Dislike this photo"
          >
            <ThumbsDown size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Custom in-site video stage: play/pause, seek, mute and fullscreen with
 * clean fallback when a Drive format cannot stream in the browser.
 */
function VideoStage({ src, fileName, watermark }) {
  const videoRef = useRef(null)
  const wrapRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [failed, setFailed] = useState(false)

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) {
      return
    }
    if (video.paused) {
      video.play().catch(() => setFailed(true))
    } else {
      video.pause()
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const seek = (value) => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.currentTime = Number(value)
    setCurrent(Number(value))
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      wrapRef.current?.requestFullscreen?.()
    }
  }

  if (failed) {
    return (
      <div className="mp-viewer__fallback">
        <VideoOff size={26} aria-hidden="true" />
        <p className="mp-viewer__fallback-title">This video format cannot be played in your browser.</p>
        <p className="mp-viewer__fallback-text">
          The studio can share this clip directly. Nothing is wrong with your gallery.
        </p>
      </div>
    )
  }

  return (
    <div className="mp-viewer__video" ref={wrapRef}>
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(timeEvent) => setCurrent(timeEvent.currentTarget.currentTime)}
        onLoadedMetadata={(metaEvent) => setDuration(metaEvent.currentTarget.duration)}
        onError={() => setFailed(true)}
        aria-label={fileName ?? 'Event video'}
      />
      {watermark ? <Watermark /> : null}

      <div className="mp-viewer__video-bar">
        <button type="button" className="mp-viewer__vbtn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
        <span className="mp-viewer__vtime">
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <input
          className="mp-viewer__seek"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={current}
          onChange={(changeEvent) => seek(changeEvent.target.value)}
          aria-label="Video position"
        />
        <button type="button" className="mp-viewer__vbtn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="mp-viewer__vbtn" onClick={toggleFullscreen} aria-label="Fullscreen">
          <Maximize size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
