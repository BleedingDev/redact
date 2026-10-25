'use client'
export default function ErrorBoundary({ error, reset }) { return <main><h1>Recovered boundary</h1><p data-testid="error-message">{error.message}</p><button onClick={() => reset()}>Reset boundary</button></main> }
