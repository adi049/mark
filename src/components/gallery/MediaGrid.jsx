import { Play } from 'lucide-react'
import { Watermark } from '@/components/gallery/Watermark'
import { mediaSrc } from '@/lib/drive'

/**
 * Gallery grid of media tiles. Thumbnails load lazily and are the only
 * thing requested until a tile is opened; the full size streams when the
 * viewer needs it.
 */
export function MediaGrid({ media, code, watermark, onOpen }) {
  return (
    <div className="mp-cg-grid">
      {media.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className="mp-cg-tile"
          onClick={() => onOpen(item, index)}
          aria-label={
            item.file_type === 'video' ? `Play video ${item.file_name ?? index + 1}` : `Open photo ${item.file_name ?? index + 1}`
          }
        >
          <img
            src={mediaSrc(item.id, code, 'thumb')}
            alt={item.file_type === 'video' ? `Video ${item.file_name ?? ''}`.trim() : (item.file_name ?? 'Photo')}
            loading="lazy"
            decoding="async"
          />
          {watermark ? <Watermark compact /> : null}
          {item.file_type === 'video' ? (
            <span className="mp-cg-tile__play" aria-hidden="true">
              <Play size={18} />
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
