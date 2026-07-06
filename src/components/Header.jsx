import { Settings, Zap, Sun, Moon } from 'lucide-react'

export default function Header({ onSettings, demoMode, onToggleDemo, theme = 'dark', onToggleTheme }) {
  const isLight = theme === 'light'
  return (
    <header className="lf-header sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-white text-base tracking-tight">LessonForge</span>
            <span className="text-xs text-gray-500">Qwen + Wan · Alibaba Cloud</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">

          {/* Theme toggle — F1 dark ↔ academic light */}
          <button
            onClick={onToggleTheme}
            title={isLight ? 'Switch to dark (F1) mode' : 'Switch to light (academic) mode'}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
          >
            {isLight ? <Moon size={13} /> : <Sun size={13} />}
            <span className="hidden sm:inline">{isLight ? 'Dark' : 'Light'}</span>
          </button>

          {/* Demo mode toggle */}
          <button
            onClick={onToggleDemo}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              demoMode
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${demoMode ? 'bg-amber-400 animate-pulse' : 'bg-gray-600'}`} />
            {demoMode ? 'Demo ON' : 'Demo'}
          </button>

          <button
            onClick={onSettings}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  )
}
