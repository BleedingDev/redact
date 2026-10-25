// Lazy owns a record so it can also read frozen promises. use() adopts the
// status fields shared with React and Flight on the thenable itself.
export function readThenable<T>(thenable: PromiseLike<T>, state: any = thenable): T {
  if (state.status === undefined) {
    state.status = 'pending'
    thenable.then(value => {
      if (state.status === 'pending') {
        state.status = 'fulfilled'
        state.value = value
      }
    }, reason => {
      if (state.status === 'pending') {
        state.status = 'rejected'
        state.reason = reason
      }
    })
  }
  if (state.status === 'fulfilled') return state.value
  if (state.status === 'rejected') throw state.reason
  throw thenable
}
