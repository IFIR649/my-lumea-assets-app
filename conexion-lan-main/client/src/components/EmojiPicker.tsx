const EMOJIS = [
  '😀',
  '😄',
  '😂',
  '🥲',
  '😍',
  '😎',
  '🤝',
  '✅',
  '⚠️',
  '🔥',
  '💡',
  '📌',
  '📎',
  '🧠',
  '👀',
  '🙏',
  '🎯',
  '🚀',
  '❤️',
  '👍',
  '👎',
  '😅',
  '😤',
  '😭',
  '🤯'
]

export function EmojiPicker({ open, onPick }: { open: boolean; onPick: (emoji: string) => void }) {
  if (!open) return null

  return (
    <div className="absolute bottom-14 right-0 z-20 w-[240px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:right-20">
      <div className="grid grid-cols-5 gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl text-lg hover:bg-slate-100"
            onClick={() => onPick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
