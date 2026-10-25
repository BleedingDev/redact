import TaskList from './task-list'
import { tasks } from './data'
import { readSession } from './store'

export default async function Page() {
  const session = await readSession()
  return <main className="project" data-page="project">
    <div className="project-heading"><span className="project-icon" aria-hidden="true">↗</span><div><h1>Website launch</h1><p>Acme storefront · Launching November 12</p></div></div>
    <TaskList tasks={tasks.map(task => ({ ...task, status: session[task.id].status }))} />
  </main>
}
