/**
 * prompt-copilot — Client 半边。
 *
 * 只读宿主算好的投影（key: prompt-copilot），不自己调模型：
 *   - 输入框内的灰字提示：显示预测的下一句，Tab 或点击落字；
 *   - + 号那一列的魔法棒：弹出人话摘要，可编辑，编辑存本机。
 */
window.__ModuleLoader__.load({
  id: 'dsh-conversation-companion',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    const KEY = 'prompt-copilot'
    const NS = 'pc.v1'

    const CSS = {
      pill: {
        position: 'absolute', left: 12, bottom: 8, maxWidth: 'min(520px, 70%)',
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-subtle, #e2e2e2)',
        background: 'var(--dsw-alias-bg-elevated, #fff)',
        color: 'var(--dsw-alias-text-tertiary, #8a8a8a)',
        fontSize: 12, lineHeight: '20px', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)', zIndex: 2,
      },
      kbd: {
        padding: '0 5px', borderRadius: 4, fontSize: 11, flex: '0 0 auto',
        border: '1px solid var(--dsw-alias-border-subtle, #dedede)',
        background: 'var(--dsw-alias-bg-subtle, #f5f5f5)',
      },
      text: { overflow: 'hidden', textOverflow: 'ellipsis' },
      wand: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, marginRight: 2, padding: 0, border: 'none',
        borderRadius: 8, background: 'transparent', cursor: 'pointer',
        color: 'var(--dsw-alias-icon-secondary, #8a8a8a)',
      },
      panel: {
        position: 'fixed', margin: 0, zIndex: 2147483647, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 14, padding: 20,
        minWidth: 'min(360px, calc(100vw - 24px))', minHeight: 'min(280px, calc(100vh - 24px))',
        maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 24px)',
        resize: 'both', overflow: 'hidden', pointerEvents: 'auto',
        border: '1px solid var(--dsw-alias-border-subtle, #ddd)',
        borderRadius: 14, background: 'var(--dsw-alias-bg-elevated, #fff)',
        color: 'var(--dsw-alias-text-primary, #171717)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.22)', fontSize: 16, lineHeight: 1.7,
      },
      row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
      title: { fontSize: 15, fontWeight: 600 },
      body: {
        flex: '1 1 0', minHeight: 0, width: '100%', resize: 'none', boxSizing: 'border-box', padding: 12,
        borderRadius: 10, lineHeight: 1.7, font: 'inherit', color: 'inherit',
        border: '1px solid var(--dsw-alias-border-subtle, #e2e2e2)',
        background: 'var(--dsw-alias-bg-subtle, #fafafa)', outline: 'none',
      },
      hint: { fontSize: 12, color: 'var(--dsw-alias-text-secondary, #8a8a8a)' },
      btn: {
        padding: '6px 12px', borderRadius: 8, cursor: 'pointer', font: 'inherit',
        border: '1px solid var(--dsw-alias-border-subtle, #e2e2e2)',
        background: 'transparent', color: 'inherit',
      },
    }


    function readEdit(sessionId, at) {
      try { return JSON.parse(localStorage.getItem(NS + '.summary.' + sessionId + '.' + at)) } catch { return null }
    }
    function writeEdit(sessionId, at, text) {
      try { localStorage.setItem(NS + '.summary.' + sessionId + '.' + at, JSON.stringify({ text })) } catch {}
    }

    function Dialog({ sessionId, view, onClose }) {
      const at = view?.at ?? 0
      const [text, setText] = useState('')
      const [notice, setNotice] = useState('')
      const panel = useRef(null)
      useEffect(() => {
        setText(readEdit(sessionId, at)?.text ?? view?.summary ?? '')
        setNotice('')
      }, [sessionId, at, view?.summary])
      const drag = useRef(null)
      const [position, setPosition] = useState(() => {
        try {
          const saved = JSON.parse(localStorage.getItem(NS + '.panel-position'))
          if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return { x: Math.max(12, Math.min(saved.x, innerWidth - Math.min(960, innerWidth - 24) - 12)), y: Math.max(12, Math.min(saved.y, innerHeight - Math.min(620, innerHeight - 90) - 12)) }
        } catch {}
        return { x: Math.max(12, (innerWidth - Math.min(960, innerWidth - 24)) / 2), y: Math.max(12, Math.min(70, innerHeight / 10)) }
      })
      useEffect(() => {
        const node = panel.current
        // A manual popover stays in the browser top layer, without a modal backdrop
        // or light-dismiss when the user clicks the conversation behind it.
        node.showPopover?.()
        const clamp = () => {
          const rect = node.getBoundingClientRect()
          setPosition((p) => ({ x: Math.max(12, Math.min(p.x, innerWidth - rect.width - 12)), y: Math.max(12, Math.min(p.y, innerHeight - rect.height - 12)) }))
        }
        window.addEventListener('resize', clamp)
        return () => { window.removeEventListener('resize', clamp); node.hidePopover?.() }
      }, [])
      const startDrag = (event) => {
        if (event.button !== 0 || event.target.closest('button')) return
        const rect = panel.current.getBoundingClientRect()
        drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
        event.currentTarget.setPointerCapture(event.pointerId)
        event.preventDefault()
      }
      const moveDrag = (event) => {
        if (!drag.current) return
        const rect = panel.current.getBoundingClientRect()
        const next = { x: Math.max(12, Math.min(event.clientX - drag.current.dx, innerWidth - rect.width - 12)), y: Math.max(12, Math.min(event.clientY - drag.current.dy, innerHeight - rect.height - 12)) }
        setPosition(next)
      }
      const stopDrag = () => {
        drag.current = null
        try { localStorage.setItem(NS + '.panel-position', JSON.stringify(position)) } catch {}
      }
      const hint = view?.status === 'pending' ? '正在生成摘要…' : view?.status === 'error' ? '生成失败：' + view.error : '这条回复尚无摘要；下一次回复结束后会自动生成。'
      return h(React.Fragment, null,
        h('style', null, '.pc-summary-window::backdrop{background:transparent;pointer-events:none}'),
        h('div', { ref: panel, popover: 'manual', className: 'pc-summary-window', style: { ...CSS.panel, left: position.x, top: position.y, width: 'min(960px, calc(100vw - 24px))', height: 'min(620px, calc(100vh - 90px))' }, role: 'dialog', 'aria-modal': false, 'aria-label': '人话摘要', onKeyDown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } } },
          h('div', { style: { ...CSS.row, cursor: 'move', touchAction: 'none', userSelect: 'none', flexShrink: 0 }, onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: stopDrag, onPointerCancel: stopDrag }, h('strong', null, '这条回复，用大白话说'), h('button', { style: CSS.btn, onClick: onClose }, '关闭')),
          view?.status === 'ready' || view?.summary ? h('textarea', { style: CSS.body, value: text, 'aria-label': '编辑摘要', onChange: (e) => { setText(e.target.value); writeEdit(sessionId, at, e.target.value) } }) : h('div', { style: CSS.hint, role: 'status' }, hint),
          h('div', { style: CSS.row }, h('span', { style: CSS.hint }, notice || '拖动标题栏移动 · 右下角调整大小 · 编辑自动保存'), h('button', { style: CSS.btn, disabled: !text, onClick: async () => {
            try { await navigator.clipboard.writeText(text); setNotice('已复制') } catch { setNotice('复制失败，请选中文字复制') }
          } }, '复制'))))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        let current = { sessionId: null, view: null, open: false }
        const listeners = new Set()
        // Hide only this prediction batch; switching chats must not reopen it.
        const dismissed = new Map()
        const batchKey = (view) => String(view?.sourceSeq ?? '') + ':' + String(view?.at ?? '')
        const isDismissed = (sessionId, view) => dismissed.get(sessionId) === batchKey(view)
        const setDismissed = (sessionId, view, hidden) => {
          if (hidden) dismissed.set(sessionId, batchKey(view))
          else dismissed.delete(sessionId)
          publish({})
        }
        const publish = (patch) => {
          current = { ...current, ...patch }
          for (const listener of listeners) listener()
        }
        const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }
        const getSnapshot = () => current
        const closeDialog = () => publish({ open: false })
        const openDialog = (sessionId, view) => publish({ sessionId, view, open: true })

        function Suggestions(props) {
          const view = props.useProjection(KEY)
          useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
          const draft = props.useInput((input) => input?.draft ?? '')
          const running = props.useSession((session) => session?.running ?? false)
          const [selected, setSelected] = useState(0)
          const [height, setHeight] = useState(140)
          const list = useRef(null)
          const anchor = useRef(null)
          const options = useMemo(() => (view?.next ?? []).filter((text) => typeof text === 'string' && text.trim()).slice(0, 3).map((prompt, index) => {
            // Old stored predictions have no AI titles. Keep them readable until
            // the next turn supplies semantic titles, without rewriting history.
            const tokens = [...prompt.matchAll(/\p{Script=Han}|[A-Za-z]+(?:['’][A-Za-z]+)*|[0-9]+/gu)]
            const end = tokens[13]
            const fallback = end ? prompt.slice(0, end.index + end[0].length) : prompt
            return { prompt, title: view?.titles?.[index] || fallback }
          }), [view])
          const index = Math.min(selected, Math.max(0, options.length - 1))
          const text = options[index]?.prompt ?? ''
          const available = options.length > 0 && !draft && !running && !isDismissed(props.sessionId, view)
          useEffect(() => { setSelected(0) }, [props.sessionId, view?.at])
          useEffect(() => {
            if (current.sessionId === props.sessionId) publish({ view })
          }, [props.sessionId, view])
          useEffect(() => {
            if (!available || !list.current) return
            const measure = () => setHeight(Math.ceil(list.current.getBoundingClientRect().height))
            const observer = new ResizeObserver(measure)
            observer.observe(list.current); measure()
            return () => observer.disconnect()
          }, [available])
          const dismiss = () => {
            const editor = list.current?.closest('[data-composer-card]')?.querySelector('[contenteditable="true"]')
            setDismissed(props.sessionId, view, true)
            editor?.focus({ preventScroll: true })
          }
          const accept = () => {
            if (!available || !props.inputActions) return false
            const editor = list.current?.closest('[data-composer-card]')?.querySelector('[contenteditable="true"]')
            props.inputActions.setDraft(text)
            props.inputActions.persistDraft()
            editor?.focus({ preventScroll: true })
            return true
          }
          useEffect(() => {
            if (!available) return
            const onKey = (event) => {
              if (event.repeat || event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
              const target = event.target
              const inside = list.current?.contains(target)
              const inEditor = target?.isContentEditable && target.closest('[data-composer-card]') === list.current?.closest('[data-composer-card]')
              if (!inside && !inEditor) return
              if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); dismiss()
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault(); event.stopPropagation()
                setSelected((value) => (value + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
              } else if (event.key === 'Tab' && accept()) { event.preventDefault(); event.stopPropagation() }
            }
            window.addEventListener('keydown', onKey, true)
            return () => window.removeEventListener('keydown', onKey, true)
          }, [available, text, options.length, props.inputActions, props.sessionId, view])
          useEffect(() => {
            if (!isDismissed(props.sessionId, view) || draft || running || !options.length) return
            const reopen = (event) => {
              if (event.key !== 'Tab' || event.repeat || event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
              const card = anchor.current?.closest('[data-composer-card]')
              if (!card || !event.target?.isContentEditable || event.target.closest('[data-composer-card]') !== card) return
              event.preventDefault(); event.stopPropagation()
              setDismissed(props.sessionId, view, false)
            }
            window.addEventListener('keydown', reopen, true)
            return () => window.removeEventListener('keydown', reopen, true)
          }, [available, draft, running, props.sessionId, view, options.length])
          if (!available) return h('span', { ref: anchor, hidden: true, 'aria-hidden': true })
          return h(React.Fragment, null,
            h('style', null, `[data-composer-card]:has(.pc-predictions) [data-composer-placeholder]{visibility:hidden}[data-composer-card]:has(.pc-predictions) [data-input-scroll]{min-height:${height + 12}px;max-height:none}.pc-predictions:focus{outline:none}`),
            h('div', { ref: list, className: 'pc-predictions', role: 'listbox', tabIndex: 0, 'aria-label': '下一句预测，使用上下箭头切换，Tab采用', 'aria-activedescendant': 'pc-option-' + props.sessionId + '-' + index,
              style: { position: 'absolute', top: 10, left: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 2, pointerEvents: 'auto', background: 'var(--dsw-specific-input-major, #fff)', fontSize: 14 } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', color: 'var(--dsw-alias-text-secondary, #888)', fontSize: 11 } }, h('span', null, '下一句 · ' + options.length + ' 个方向'), h('span', { style: { display: 'flex', alignItems: 'center', gap: 12 } }, h('span', null, '↑ ↓ 切换 · Tab 采用'), h('button', { type: 'button', title: '临时收起预测（Esc），新一轮预测自动显示', 'aria-label': '收起预测', style: { ...CSS.btn, padding: '2px 8px', fontSize: 12 }, onClick: dismiss }, '收起 · Esc'))),
              ...options.map((option, i) => h('div', { key: i, id: 'pc-option-' + props.sessionId + '-' + i, role: 'option', 'aria-selected': i === index,
                onMouseDown: (e) => e.preventDefault(), onClick: () => { setSelected(i); list.current?.focus({ preventScroll: true }) },
                style: { padding: '7px 10px', borderRadius: 8, border: i === index ? '1px solid var(--dsw-alias-border-subtle, #dedee7)' : '1px solid transparent', background: i === index ? 'var(--dsw-alias-bg-subtle, #f5f5f8)' : 'transparent', cursor: 'pointer', color: i === index ? 'var(--dsw-alias-text-primary, #333)' : 'var(--dsw-alias-text-secondary, #888)' } },
                h('div', { style: { fontWeight: i === index ? 600 : 400, lineHeight: '20px', overflowWrap: 'anywhere' } }, (i + 1) + '. ' + option.title),
                i === index ? h('div', { style: { marginTop: 5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6, fontWeight: 400 } }, option.prompt) : null))))
        }
        function SummaryButton(props) {
          const view = props.useProjection(KEY)
          return h('button', { type: 'button', style: CSS.wand, title: '人话摘要', 'aria-label': '人话摘要', onClick: () => openDialog(props.sessionId, view) }, '✨')
        }
        function Overlay() {
          const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
          if (!snap.open || !snap.sessionId) return null
          return h(Dialog, { sessionId: snap.sessionId, view: snap.view, onClose: closeDialog })
        }
        // Depend on the actual child declaration, not its parent before children exist.
        // sessionId/useProjection/useInput/inputActions are standard slot props.
        ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({ name: 'conversation.input.overlay', id: 'copilot-ghost', order: 5 }, Suggestions))
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({ name: 'conversation.input.left', id: 'copilot-wand', order: 5 }, SummaryButton))
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'copilot-dialog' }, Overlay))
      },
    }
  },
})
