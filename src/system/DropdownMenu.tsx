'use client'
// Part of the design system Scootch is built on, copied in. This copy is replaced with every release.

// Dropdown menu: Base UI Menu. Pass any trigger (usually a Button) and a list of items:
//   { label, icon?, shortcut?, onSelect?, disabled?, destructive? }   an action
//   { type: 'checkbox', label, checked, onCheckedChange }             a toggle
//   { type: 'label', label }  a group heading       { type: 'separator' }  a line
// Arrow keys, typeahead, Esc and focus return come from Base UI; the highlight glides between items.
import type { ComponentType, ReactElement, ReactNode, RefObject } from 'react'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import { Check } from './icons'
import OptionHighlight from './lib/OptionHighlight'
import PopupScroll from './lib/PopupScroll'

type Icon = ComponentType<{ size?: number }>
export type MenuEntry =
  | { type?: 'item'; label: ReactNode; icon?: Icon; shortcut?: string; onSelect?: () => void; disabled?: boolean; destructive?: boolean }
  | { type: 'checkbox'; label: ReactNode; checked: boolean; onCheckedChange: (checked: boolean) => void; icon?: Icon }
  | { type: 'label'; label: ReactNode }
  | { type: 'separator' }

// compact: as narrow as its items (a unit or format picker), instead of the usual 240
/** anchor: line the menu up with this element instead of the trigger (the whole field a small trigger sits in) */
export default function DropdownMenu({ trigger, items, align = 'start', compact = false, anchor }: { trigger: ReactElement; items: MenuEntry[]; align?: 'start' | 'center' | 'end'; compact?: boolean; anchor?: RefObject<HTMLElement | null> }) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner className="sc-ui-positioner" sideOffset={4} align={align} anchor={anchor}>
          <BaseMenu.Popup className="sc-ui-popup sc-ui-popup-list sc-ui-menu" data-compact={compact || undefined}>
            <PopupScroll>
            <OptionHighlight />
            {items.map((e, i) => {
              if (e.type === 'separator') return <BaseMenu.Separator key={i} className="sc-ui-separator" />
              if (e.type === 'label') return <div key={i} className="sc-ui-group-label">{e.label}</div>
              if (e.type === 'checkbox') {
                const Ico = e.icon
                return (
                  <BaseMenu.CheckboxItem key={i} className="sc-ui-item" checked={e.checked} onCheckedChange={e.onCheckedChange}>
                    {Ico && <Ico size={14} />}
                    {e.label}
                    <BaseMenu.CheckboxItemIndicator className="sc-ui-item-end">
                      <Check size={12} />
                    </BaseMenu.CheckboxItemIndicator>
                  </BaseMenu.CheckboxItem>
                )
              }
              const Ico = e.icon
              return (
                <BaseMenu.Item
                  key={i}
                  className="sc-ui-item"
                  data-destructive={e.destructive || undefined}
                  disabled={e.disabled}
                  onClick={e.onSelect}
                >
                  {Ico && <Ico size={14} />}
                  {e.label}
                  {e.shortcut && <span className="sc-ui-item-end sc-ui-shortcut">{e.shortcut}</span>}
                </BaseMenu.Item>
              )
            })}
          </PopupScroll>
</BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}
