import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function DragIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M9 5h2v2H9V5zm4 0h2v2h-2V5zM9 9h2v2H9V9zm4 0h2v2h-2V9zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z" />
    </svg>
  )
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M10 8l6 4-6 4V8z" />
    </svg>
  )
}

function VideoItem({ id, name, path, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto'
  }

  return (
    <div ref={setNodeRef} style={style} className="video-item">
      <div className="drag-handle" {...attributes} {...listeners} title="Glisser pour réordonner">
        <DragIcon />
      </div>
      <span className="video-index">{index + 1}</span>
      <span className="video-name" title={path}>{name}</span>
      <button className="remove-btn" onClick={() => onRemove(id)} title="Supprimer">×</button>
    </div>
  )
}

export default function App() {
  const [videos, setVideos] = useState([])
  const [outputPath, setOutputPath] = useState('')
  const [merging, setMerging] = useState(false)
  const [progressTime, setProgressTime] = useState(null)
  const [error, setError] = useState(null)
  const [successPath, setSuccessPath] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const cleanupRef = useRef(null)
  const isDragOverRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const addVideoPaths = useCallback((paths) => {
    setVideos(prev => {
      const existing = new Set(prev.map(v => v.path))
      const fresh = paths
        .filter(p => !existing.has(p))
        .map(p => ({
          id: `${p}__${Date.now()}__${Math.random()}`,
          path: p,
          name: p.split(/[\\/]/).pop()
        }))
      return [...prev, ...fresh]
    })
    setError(null)
    setSuccessPath(null)
  }, [])

  const handleSelectVideos = async () => {
    const paths = await window.api.selectVideos()
    if (paths?.length) addVideoPaths(paths)
  }

  const handleSelectOutput = async () => {
    const path = await window.api.selectOutput()
    if (path) {
      setOutputPath(path)
      setError(null)
    }
  }

  const handleRemove = (id) => setVideos(prev => prev.filter(v => v.id !== id))

  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setVideos(prev => {
        const from = prev.findIndex(v => v.id === active.id)
        const to = prev.findIndex(v => v.id === over.id)
        return arrayMove(prev, from, to)
      })
    }
  }

  const handleWindowDragOver = (e) => {
    e.preventDefault()
    if (!isDragOverRef.current) {
      isDragOverRef.current = true
      setIsDragOver(true)
    }
  }
  const handleWindowDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      isDragOverRef.current = false
      setIsDragOver(false)
    }
  }
  const handleWindowDrop = (e) => {
    e.preventDefault()
    isDragOverRef.current = false
    setIsDragOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .filter(f => /\.(mp4|avi|mkv|mov|webm|flv|wmv|ts|m4v|3gp)$/i.test(f.name))
      .map(f => window.api.getFilePath(f))
    if (paths.length) addVideoPaths(paths)
  }

  const handleMerge = async () => {
    setError(null)
    setSuccessPath(null)

    if (videos.length < 2) { setError('Ajoute au moins 2 vidéos.'); return }
    if (!outputPath) { setError('Choisis un fichier de sortie.'); return }

    setMerging(true)
    setProgressTime(null)

    cleanupRef.current = window.api.onMergeProgress(({ time }) => setProgressTime(time))

    try {
      await window.api.mergeVideos({ videoPaths: videos.map(v => v.path), outputPath })
      setSuccessPath(outputPath)
    } catch (err) {
      setError(err?.message || 'Erreur lors de la fusion.')
    } finally {
      setMerging(false)
      setProgressTime(null)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }

  const handleClear = () => {
    setVideos([])
    setOutputPath('')
    setError(null)
    setSuccessPath(null)
  }

  return (
    <div
      className={`app${isDragOver ? ' drag-over' : ''}`}
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
    >
      {isDragOver && (
        <div className="drop-overlay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <p>Dépose tes vidéos ici</p>
        </div>
      )}

      <header className="app-header">
        <div>
          <h1>Videos Linker</h1>
          <p className="subtitle">Fusion sans perte de qualité · stream copy</p>
        </div>
      </header>

      <main className="app-main">
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={handleSelectVideos} disabled={merging}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ajouter des vidéos
          </button>
          {videos.length > 0 && (
            <button className="btn btn-ghost" onClick={handleClear} disabled={merging}>
              Tout effacer
            </button>
          )}
          <span className="video-count">{videos.length > 0 ? `${videos.length} vidéo${videos.length > 1 ? 's' : ''}` : ''}</span>
        </div>

        {videos.length === 0 ? (
          <div className="empty-state">
            <VideoIcon />
            <p>Aucune vidéo ajoutée</p>
            <p className="hint">Clique sur "Ajouter" ou glisse tes vidéos ici</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={videos.map(v => v.id)} strategy={verticalListSortingStrategy}>
              <div className="video-list">
                {videos.map((video, index) => (
                  <VideoItem
                    key={video.id}
                    id={video.id}
                    name={video.name}
                    path={video.path}
                    index={index}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="output-section">
          <label className="section-label">Fichier de sortie</label>
          <div className="output-row">
            <input
              className="output-input"
              type="text"
              readOnly
              value={outputPath}
              placeholder="Aucun fichier sélectionné…"
              onClick={handleSelectOutput}
            />
            <button className="btn btn-secondary" onClick={handleSelectOutput} disabled={merging}>
              Parcourir
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {successPath && (
          <div className="alert alert-success">
            <span>✓ Fusion terminée avec succès !</span>
            <button className="btn-link" onClick={() => window.api.showInFolder(successPath)}>
              Ouvrir dans l'explorateur
            </button>
          </div>
        )}

        {merging && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill indeterminate" />
            </div>
            <p className="progress-label">
              {progressTime ? `Traitement : ${progressTime}` : 'Fusion en cours…'}
            </p>
          </div>
        )}

        <button
          className="btn btn-merge"
          onClick={handleMerge}
          disabled={merging || videos.length < 2 || !outputPath}
        >
          {merging ? (
            <><span className="spinner" /> Fusion en cours…</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M5 4h3l2 5-2.5 1.5A11 11 0 0014.5 16.5L16 14l5 2v3a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2z" />
              </svg>
              Fusionner les vidéos
            </>
          )}
        </button>
      </main>
    </div>
  )
}
