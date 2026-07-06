import React from 'react'

/**
 * Catches render/runtime errors anywhere below it so a single thrown error
 * (e.g. a storage quota failure mid-render) shows a recoverable message
 * instead of unmounting React and leaving a BLANK SCREEN.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught:', error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error)
      const isQuota = /quota|exceeded/i.test(msg)
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950 text-gray-200">
          <div className="max-w-md w-full rounded-2xl border border-red-900/50 bg-red-950/30 p-6">
            <h1 className="text-lg font-bold text-red-300 mb-2">Something hit an error</h1>
            <p className="text-sm text-gray-300 mb-3">
              {isQuota
                ? 'Your browser storage is full — that can happen when lots of lessons and preview images pile up. Clearing old render jobs will fix it.'
                : 'The screen crashed while rendering. Your data is safe; you can try to recover below.'}
            </p>
            <p className="text-xs text-gray-500 font-mono break-all mb-4">{msg}</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-brand-900/50 border border-brand-800 text-brand-200 text-sm font-medium hover:bg-brand-900/80">
                Try again
              </button>
              <button
                onClick={() => { try { localStorage.removeItem('lf_jobs') } catch {} ; this.setState({ error: null }); location.reload() }}
                className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-800 text-red-200 text-sm font-medium hover:bg-red-900/70"
                title="Removes cached render jobs (lessons, educators and locations are kept).">
                Clear render jobs &amp; reload
              </button>
              <button
                onClick={() => location.reload()}
                className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-700">
                Reload
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
