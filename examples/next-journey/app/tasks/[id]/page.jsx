import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { initialComments, tasks } from '../../data'
import { delay, readSession } from '../../store'
import { Icon } from '../../icons'
import { StatusControl, Comments } from './task-controls'

async function Activity({ id, comments }) {
  await delay(900)
  return <Comments id={id} comments={[...initialComments, ...comments.map(c => ({ ...c, author: 'You', initials: 'JL', color: 'user', time: 'Just now' }))]} />
}

export default async function Task({ params }) {
  const { id } = await params
  const task = tasks.find(task => task.id === id)
  if (!task) notFound()
  const session = (await readSession())[id]
  return <main className="detail" data-page="task">
    <Link className="back-link" href="/" data-journey="back"><Icon name="back" />Website launch</Link>
    <div className="task-identifier">{id}<span>{task.category}</span></div>
    <h1>{task.title}</h1>
    <p className="description">{task.description || 'Bring this piece of the launch across the finish line. Leave a note for the team when it’s ready for review.'}</p>
    <div className="task-properties"><div><span className="property-label">Assignee</span><span className={`avatar ${task.color}`}>{task.initials}</span>{task.owner}</div><div><span className="property-label">Priority</span><span className={`priority ${task.priority.toLowerCase()}`} aria-hidden="true">▥</span>{task.priority}</div></div>
    <StatusControl id={id} status={session.status} />
    {task.checklist && <div className="checklist"><h2>Before review</h2>{task.checklist.map(item => <label key={item}><input type="checkbox" /><span>{item}</span></label>)}</div>}
    <section className="activity" aria-labelledby="activity-title"><h2 id="activity-title"><Icon name="chat" />Activity</h2>
      <Suspense fallback={<div className="activity-loading" role="status" data-journey="streaming"><span className="spinner" />Loading activity…</div>}><Activity id={id} comments={session.comments} /></Suspense>
    </section>
  </main>
}
