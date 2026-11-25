'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Comments: notes pinned to things on a page, as Scootch uses them.
//   CommentThread – one note, on grey-5: open; editing (click the text or Open; Enter saves, Esc leaves); focused
//                   (opened from its marker: a grey ring, ready to edit); resolved (an outline, grey text,
//                   with the reply and Reopen)
//   CommentBox    – the threads so far, then a Textarea for a new one. Enter saves; Shift+Enter is a new line.
//                   focusId opens that note's thread (ringed, ready to edit); autoFocus puts the cursor in the new one
//   Marker        – the numbered pin: a note (accent), an adjusted element (text colour), active (opened:
//                   a little bigger), resolved (surface). Flat, it's the number in a list
//   NoteList      – a numbered list of notes, one row each with its marker, its text and where it is
import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import Textarea from './Textarea'

export type CommentNote = { id?: string; comment: string; status: 'open' | 'resolved'; reply?: string }
export type MarkerKind = 'note' | 'change'
export type NoteListItem = { id: string; n: number; kind: MarkerKind; text: string; detail?: string }

const keys = (submit: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
  if (e.key === 'Escape') e.currentTarget.blur()
}

type ThreadProps = {
  note: CommentNote
  focus?: boolean
  editing?: boolean
  onChange: (patch: Partial<CommentNote>) => void
  onRemove: () => void
}

export function CommentThread({ note, focus = false, editing: startEditing = false, onChange, onRemove }: ThreadProps) {
  // 'click' when opened by hand (then the editor takes focus), 'initial' when the state starts that way
  const [editing, setEditing] = useState<'click' | 'initial' | null>(startEditing || focus ? 'initial' : null)
  const [draft, setDraft] = useState(note.comment)
  const resolved = note.status === 'resolved'
  const edit = () => (setDraft(note.comment), setEditing('click'))
  const save = () => {
    const t = draft.trim()
    if (t && t !== note.comment) onChange({ comment: t, status: 'open' })
    setEditing(null)
  }
  return (
    <div className="sc-ui-thread" data-resolved={resolved || undefined} data-focus={focus || undefined}>
      {editing ? (
        <Textarea
          autoFocus={editing === 'click'}
          aria-label="Edit the note"
          minRows={2}
          maxRows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={keys(save)}
          onBlur={save}
        />
      ) : (
        <button type="button" className="sc-ui-thread-text sc-ui-focus" title="Edit" onClick={edit}>
          {note.comment}
        </button>
      )}
      {resolved && note.reply && <p className="sc-ui-thread-reply">{note.reply}</p>}
      <div className="sc-ui-thread-actions">
        {/* Its status. An open note's opens it to edit, like clicking its text */}
        <span className="sc-ui-thread-status">
          {resolved ? (
            'Resolved'
          ) : (
            <button type="button" className="sc-ui-thread-action sc-ui-focus" title="Edit" onClick={edit} disabled={!!editing}>
              Open
            </button>
          )}
        </span>
        {resolved && (
          <button type="button" className="sc-ui-thread-action sc-ui-focus" onClick={() => onChange({ status: 'open' })}>
            Reopen
          </button>
        )}
        <button type="button" className="sc-ui-thread-action sc-ui-focus" onClick={onRemove}>
          Delete
        </button>
      </div>
    </div>
  )
}

type BoxProps = {
  notes: (CommentNote & { id: string })[]
  onAdd: (text: string) => void
  onChange: (id: string, patch: Partial<CommentNote>) => void
  onRemove: (id: string) => void
  placeholder?: string
  defaultText?: string
  focusId?: string | null
  autoFocus?: boolean
}

export function CommentBox({ notes, onAdd, onChange, onRemove, placeholder = 'Add a note. Enter to save', defaultText = '', focusId = null, autoFocus = false }: BoxProps) {
  const [text, setText] = useState(defaultText)
  const add = () => {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }
  return (
    <div className="sc-ui-comment">
      {notes.map((n) => (
        // Keyed on focus too, so opening a note starts its thread fresh in the focused state
        <CommentThread key={`${n.id}${n.id === focusId ? '-focus' : ''}`} note={n} focus={n.id === focusId} onChange={(p) => onChange(n.id, p)} onRemove={() => onRemove(n.id)} />
      ))}
      <Textarea autoFocus={autoFocus} aria-label="Add a note" placeholder={placeholder} minRows={2} maxRows={6} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={keys(add)} />
    </div>
  )
}

type MarkerProps = {
  n: number
  kind?: MarkerKind
  active?: boolean
  resolved?: boolean
  flat?: boolean
  title?: string
  style?: CSSProperties
  onClick?: () => void
}

export function Marker({ n, kind = 'note', active, resolved, flat, title, style, onClick }: MarkerProps) {
  const data = {
    className: 'sc-ui-marker',
    'data-kind': kind,
    'data-active': active || undefined,
    'data-resolved': resolved || undefined,
    'data-flat': flat || undefined,
    title,
    style,
  }
  return flat ? (
    <span {...data}>{n}</span>
  ) : (
    <button type="button" {...data} className="sc-ui-marker sc-ui-focus" onClick={onClick}>
      {n}
    </button>
  )
}

export function NoteList({ items, onOpen }: { items: NoteListItem[]; onOpen?: (item: NoteListItem) => void }) {
  return (
    <div className="sc-ui-notes">
      {items.map((it) => (
        <button key={it.id} type="button" className="sc-ui-note sc-ui-focus" onClick={() => onOpen?.(it)}>
          <Marker n={it.n} kind={it.kind} flat />
          <span className="sc-ui-note-main">
            <span className="sc-ui-note-text sc-text-label">{it.text}</span>
            {it.detail && <span className="sc-ui-note-detail sc-text-label">{it.detail}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
