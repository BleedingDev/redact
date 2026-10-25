'use client'

import { useActionState, useOptimistic } from 'react'
import { useFormStatus } from 'react-dom'
import { changeStatus, postComment } from '../../actions'
import { statuses, statusClass } from '../../data'
import { Icon } from '../../icons'

function Submit({ children, pendingText, ...props }) {
  const { pending } = useFormStatus()
  return <button className="primary-button" type="submit" disabled={pending} {...props}>{pending && <span className="spinner" />}{pending ? pendingText : children}</button>
}

export function StatusControl({ id, status }) {
  const [state, dispatch, pending] = useActionState(changeStatus, { error: null })
  const [optimisticStatus, setOptimistic] = useOptimistic(status)
  return <div className="status-control">
    <div className="status-current"><span className="property-label">Status</span><span className={`status-pill ${statusClass(optimisticStatus)}`} data-journey="status">{optimisticStatus}</span><span role="status" className="save-status" data-journey="status-result">{pending ? 'Saving…' : 'Saved'}</span></div>
    <form action={data => { setOptimistic(data.get('status')); dispatch(data) }}>
      <input type="hidden" name="id" value={id} />
      <select name="status" aria-label="Task status" defaultValue={status} data-journey="status-select" disabled={pending}>{statuses.map(value => <option key={value}>{value}</option>)}</select>
      <Submit pendingText="Saving…" data-journey="save-status">Update status</Submit>
    </form>
    {state.error && <p role="alert" className="error-message">{state.error}</p>}
  </div>
}

export function Comments({ id, comments }) {
  const [state, dispatch, pending] = useActionState(postComment, { error: null })
  const [optimisticComments, addComment] = useOptimistic(comments, (current, text) => [...current, { id: 'pending', text, author: 'You', initials: 'JL', color: 'user', time: 'Posting…', pending: true }])
  return <div data-journey="activity-ready">
    <ol className="comments" aria-label="Comments">{optimisticComments.map(comment => <li key={comment.id} className={comment.pending ? 'comment pending' : 'comment'} data-pending={comment.pending || undefined}>
      <span className={`avatar ${comment.color}`}>{comment.initials}</span><div><div className="comment-meta"><strong>{comment.author}</strong><span>{comment.time}</span></div><p>{comment.text}</p></div>
    </li>)}</ol>
    <form className="comment-form" action={data => { const text = String(data.get('comment') || '').trim(); if (text) addComment(text); dispatch(data) }}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor="comment">Add a comment</label>
      <textarea id="comment" name="comment" placeholder="Share an update with your team…" maxLength={200} rows={3} aria-describedby={state.error ? 'comment-error' : undefined} aria-invalid={!!state.error} data-journey="comment" disabled={pending} />
      <div className="comment-actions"><span className="comment-feedback">{state.error ? <span id="comment-error" role="alert" className="error-message" data-journey="comment-error">{state.error}</span> : <span>Visible to your team</span>}</span><Submit pendingText="Posting…" data-journey="post-comment">Post comment<Icon name="arrow" /></Submit></div>
    </form>
  </div>
}
