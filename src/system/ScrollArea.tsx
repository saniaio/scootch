'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// ScrollArea: Base UI Scroll Area. Native scrolling with our own thin scrollbar, the same in every browser.
// The bar shows while you hover or scroll. Set the height with maxHeight (or className/style).
import type { CSSProperties, ReactNode } from 'react'
import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area'

type ScrollAreaProps = {
  children: ReactNode
  maxHeight?: CSSProperties['maxHeight']
  horizontal?: boolean
  className?: string
  style?: CSSProperties
}

export default function ScrollArea({ children, maxHeight, horizontal, className = '', style }: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root className={`sc-ui-scroll ${className}`} style={style}>
      <BaseScrollArea.Viewport className="sc-ui-scroll-viewport" style={{ maxHeight }}>
        {/* Scrolling only down, the content is as wide as the area (Base UI's fit-content would let a wide field
            push it past the edge, where it's clipped) */}
        <BaseScrollArea.Content style={horizontal ? undefined : { minWidth: 0 }}>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar className="sc-ui-scrollbar" orientation="vertical">
        <BaseScrollArea.Thumb className="sc-ui-scroll-thumb" />
      </BaseScrollArea.Scrollbar>
      {horizontal && (
        <BaseScrollArea.Scrollbar className="sc-ui-scrollbar" orientation="horizontal">
          <BaseScrollArea.Thumb className="sc-ui-scroll-thumb" />
        </BaseScrollArea.Scrollbar>
      )}
    </BaseScrollArea.Root>
  )
}
