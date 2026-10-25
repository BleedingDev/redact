'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from './icons'
import { statusClass } from './data'

export default function TaskList({ tasks }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All tasks')
  const visible = tasks.filter(task => task.title.toLowerCase().includes(query.toLowerCase()) && (filter !== 'Open' || task.status !== 'Done'))
  const done = tasks.filter(task => task.status === 'Done').length
  return <>
    <div className="project-progress"><span>{done} of {tasks.length} complete</span><div className="progress-track"><div style={{ width: `${done / tasks.length * 100}%` }} /></div><div className="team" aria-label="Project members"><span className="avatar peach">MC</span><span className="avatar lavender">AM</span><span className="avatar sage">SR</span></div></div>
    <div className="list-toolbar">
      <div className="tabs" aria-label="Task filter">{['All tasks', 'Open'].map(value => <button key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <label className="search"><Icon name="search" /><input aria-label="Find a task" placeholder="Find a task…" value={query} onChange={e => setQuery(e.target.value)} data-journey="search" /></label>
    </div>
    <ul className="task-list" aria-label="Tasks">{visible.map(task => <li key={task.id}>
      <Link prefetch={false} href={`/tasks/${task.id}`} className="task-row" data-journey={task.id}>
        <span className={`status-icon ${statusClass(task.status)}`} aria-label={task.status}>{task.status === 'Done' ? <Icon name="check" /> : null}</span>
        <span className="task-main"><span className="task-title">{task.title}</span><span className="task-meta">{task.id}<span>·</span>{task.category}</span></span>
        <span className={`status-pill ${statusClass(task.status)}`}>{task.status}</span>
        <span className={`avatar ${task.color}`} title={task.owner}>{task.initials}</span>
        <Icon name="arrow" className="row-arrow" />
      </Link>
    </li>)}</ul>
    {!visible.length && <p className="empty">No tasks match “{query}”.</p>}
  </>
}
