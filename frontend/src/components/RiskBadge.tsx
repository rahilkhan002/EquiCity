import clsx from 'clsx'

const tierColors = {
  LOW: 'bg-green-100 text-green-800 border-green-200',
  MODERATE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
}

export function RiskBadge({ tier }: { tier: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        tierColors[tier as keyof typeof tierColors] ?? 'bg-gray-100 text-gray-700'
      )}
    >
      {tier}
    </span>
  )
}
