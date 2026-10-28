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
      // Icon-only controls: a full 30px square hit area that works with a mouse
      // and with a finger, so every prediction action is reachable on a phone.
      iconBtn: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, minWidth: 30, padding: 0, margin: 0,
        border: 'none', borderRadius: 8, background: 'transparent',
        color: 'var(--dsw-alias-text-secondary, #888)', cursor: 'pointer',
        touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        lineHeight: 1, flex: '0 0 auto',
      },
    }

    // Inline glyphs instead of keyboard hints: the same actions as Tab, ↓/→,
    // ←/→, ↑ and Esc, but announced by icon and usable by tap or click.
    const ICON_PATHS = {
      accept: 'M3.5 8.5 6.6 11.6 12.5 4.6',
      more: 'M4 6.2 8 10.2 12 6.2',
      less: 'M4 9.8 8 5.8 12 9.8',
      older: 'M10.4 4.4 6.4 8 10.4 11.6',
      newer: 'M5.6 4.4 9.6 8 5.6 11.6',
      refresh: 'M12.9 8.2A4.9 4.9 0 1 1 11.3 4.2M13.1 3.2v3.4H9.7',
      hide: 'M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8',
    }
    function Icon({ name, size = 15 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: ICON_PATHS[name] }))
    }


    // Review requests between two user messages belong to the same input round.
    // Keep the source command nodes intact; only their presentation is grouped.
    function reviewRound(snapshot, current) {
      let batch = [], found = false
      for (const key of snapshot.order) {
        const view = snapshot.nodes.get(key)
        if (view?.kind === 'user') {
          if (found) break
          batch = []
        }
        if (view?.kind === 'command' && view.data?.name === 'companion-review') {
          batch.push(view.data)
          if (view.data.commandId === current.commandId) found = true
        }
      }
      return JSON.stringify(found ? batch : [current])
    }
    function ReviewRound({ node, useChat }) {
      const serialized = useChat ? useChat(snapshot => reviewRound(snapshot, node)) : JSON.stringify([node])
      const records = JSON.parse(serialized)
      if (records[0]?.commandId !== node.commandId) return h('span', { className: 'pc-review-hidden', hidden: true })
      return h('div', { className: 'pc-review-round' },
        h('style', null, '[data-chat-flow-kind="command"]:has(.pc-review-hidden){display:none!important}[data-chat-flow-kind="command"]:has(.pc-review-round){margin-block:4px!important}.pc-review-round summary{user-select:none}.pc-review-round details details{margin:0!important}'),
        h('details', { key: node.commandId || node.seq, style: { fontSize: 12, lineHeight: 1.5 } },
          h('summary', { style: { cursor: 'pointer', padding: '2px 0', color: 'var(--dsw-alias-text-secondary, #777)' } }, `输入检查 · ${records.length} 次`),
          h('div', { style: { paddingLeft: 12, borderLeft: '1px solid var(--dsw-alias-border-subtle, #ddd)', margin: '4px 0' } },
            records.map((record, i) => h(ReviewRecord, { key: record.commandId || record.seq, node: record, number: i + 1 })))))
    }

    function ReviewRecord({ node, number }) {
      const outcome = node.outcome
      let result = null
      try { result = JSON.parse(outcome?.text || '') } catch {}
      const edits = Array.isArray(result?.edits) ? result.edits.filter(e => e && typeof e.before === 'string' && typeof e.after === 'string') : []
      const deep = result?.mode === 'deep'
      const label = deep ? '深度改写' : '输入检查'
      const status = !outcome ? '检查中' : outcome.kind === 'error' ? '未完成' : result ? edits.length ? `${edits.length} 处建议` : '无需修改' : '查看结果'
      const muted = 'var(--dsw-alias-text-secondary, #777)'
      const section = { marginTop: 4, padding: 8, borderRadius: 8, background: 'var(--dsw-alias-bg-subtle, #f7f7f8)', overflowWrap: 'anywhere' }
      return h('details', { key: node.commandId || node.seq, style: { fontSize: 12, lineHeight: 1.5, margin: '2px 0', color: 'var(--dsw-alias-text-primary, #222)' } },
        h('summary', { style: { cursor: 'pointer', color: muted, padding: '2px 0' } }, `${number ? number + '. ' : ''}${label} · ${status}`),
        h('div', { style: section },
          h('div', { style: { color: muted, marginBottom: 8 } }, deep ? '结合上下文提出更积极的改写，可能调整表达方向。' : '检查笔误、歧义和明显的表达问题。'),
          h('div', { style: { color: muted } }, '这是当时生成的建议记录，不代表你已采用。'),
          !outcome ? h('p', { role: 'status' }, '正在检查，完成后可在这里查看建议。') :
          outcome.kind === 'error' ? h('p', null, outcome.text || '检查未完成，请稍后重试。') :
          result ? edits.length ? edits.map((edit, i) => h('section', { key: i, style: { marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--dsw-alias-border-subtle, #ddd)' } },
            h('strong', null, `建议 ${i + 1}`),
            h('div', null, h('span', { style: { color: muted } }, '修改前：'), h('del', { style: { color: '#b42318', whiteSpace: 'pre-wrap' } }, edit.before || '（空）')),
            h('div', null, h('span', { style: { color: muted } }, '建议改为：'), h('ins', { style: { color: '#067647', whiteSpace: 'pre-wrap', textDecoration: 'none' } }, edit.after || '（删除这段）')),
            h('div', { style: { color: muted, marginTop: 4 } }, `原因：${typeof edit.reason === 'string' && edit.reason ? edit.reason : '未提供说明'}`))) : h('p', null, '这次没有发现需要修改的地方。') :
          h('p', { style: { whiteSpace: 'pre-wrap' } }, outcome.text || '没有可显示的结果。')))
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
      const hint = view?.status === 'error' ? '生成失败：' + view.error : view?.status === 'pending' || view?.summaryPending ? '正在生成摘要…' : '这条回复尚无摘要；下一次回复结束后会自动生成。'
      return h(React.Fragment, null,
        h('style', null, '.pc-summary-window::backdrop{background:transparent;pointer-events:none}'),
        h('div', { ref: panel, popover: 'manual', className: 'pc-summary-window', style: { ...CSS.panel, left: position.x, top: position.y, width: 'min(960px, calc(100vw - 24px))', height: 'min(620px, calc(100vh - 90px))' }, role: 'dialog', 'aria-modal': false, 'aria-label': '人话摘要', onKeyDown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } } },
          h('div', { style: { ...CSS.row, cursor: 'move', touchAction: 'none', userSelect: 'none', flexShrink: 0 }, onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: stopDrag, onPointerCancel: stopDrag }, h('strong', null, '这条回复，用大白话说'), h('button', { style: CSS.btn, onClick: onClose }, '关闭')),
          view?.summary ? h('textarea', { style: CSS.body, value: text, 'aria-label': '编辑摘要', onChange: (e) => { setText(e.target.value); writeEdit(sessionId, at, e.target.value) } }) : h('div', { style: CSS.hint, role: 'status' }, hint),
          h('div', { style: CSS.row }, h('span', { style: CSS.hint }, notice || '拖动标题栏移动 · 右下角调整大小 · 编辑自动保存'), h('button', { style: CSS.btn, disabled: !text, onClick: async () => {
            try { await navigator.clipboard.writeText(text); setNotice('已复制') } catch { setNotice('复制失败，请选中文字复制') }
          } }, '复制'))))
    }

    return {
      inject: ['slots', 'remote', 'remote.commands'],
      apply(ctx) {
        let current = { sessionId: null, view: null, open: false }
        const listeners = new Set()
        let predictionsHidden = false
        try { predictionsHidden = localStorage.getItem(NS + '.predictions-hidden') === 'true' } catch {}
        const setPredictionsHidden = hidden => {
          predictionsHidden = hidden
          try { localStorage.setItem(NS + '.predictions-hidden', String(hidden)) } catch {}
          publish({})
        }
        // Expansion belongs only to the current prediction batch; new batches are compact.
        const titleCache = new Map()
        const titleRequests = new Set()
        const titleNeedsRepair = (title, prompt) => !title || /…|\.{3}|(?:该|把|以及|或者|然后|因为)$/.test(title.trim()) || (title !== prompt && prompt.startsWith(title))
        const expandedBatches = new Map()
        const batchKey = (view) => String(view?.sourceSeq ?? view?.at ?? '')
        const isExpanded = (sessionId, view) => expandedBatches.get(sessionId) === batchKey(view)
        const setExpanded = (sessionId, view, expanded) => {
          if (expanded) expandedBatches.set(sessionId, batchKey(view))
          else expandedBatches.delete(sessionId)
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
          const live = props.useProjection(KEY)
          const [browsing, setBrowsing] = useState(null)
          const [requestNotice, setRequestNotice] = useState(null)
          const requesting = useRef(false)
          const notice = requestNotice?.sessionId === props.sessionId ? requestNotice : null
          const requestError = notice?.error ?? ''
          const batches = live?.batches?.length ? live.batches : live?.next?.length ? [live] : []
          const matched = browsing?.sessionId === props.sessionId && browsing?.sourceSeq === live?.sourceSeq ? batches.findIndex(b => b.at === browsing.at) : -1
          const page = matched < 0 ? batches.length - 1 : matched
          const batch = batches[page]
          const view = useMemo(() => batch ? { ...live, ...batch } : live, [live, batch])
          useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
          const draft = props.useInput((input) => input?.draft ?? '')
          const running = props.useSession((session) => session?.running ?? false)
          const [selected, setSelected] = useState(0)
          const [height, setHeight] = useState(140)
          const list = useRef(null)
          const anchor = useRef(null)
          const prompts = (running && !live?.manualDuringTurn ? [] : view?.next ?? []).filter(text => typeof text === 'string' && text.trim()).slice(0, 3)
          const titleKey = JSON.stringify({ prompts, titles: view?.titles ?? [] })
          const repairedTitles = titleCache.get(titleKey)
          const needsTitles = prompts.some((prompt, i) => titleNeedsRepair(view?.titles?.[i], prompt))
          useEffect(() => {
            if (!needsTitles || repairedTitles || !prompts.length || view?.candidatesPending || draft || running || predictionsHidden || titleRequests.has(titleKey)) return
            titleRequests.add(titleKey)
            Promise.resolve().then(() => ctx.remote.commands.execute(props.sessionId, '/companion-titles ' + JSON.stringify({ prompts }), []))
              .then(response => {
                if (!response.ok || response.value?.result?.kind !== 'success') return
                const { titles } = JSON.parse(response.value.result.text)
                if (!Array.isArray(titles) || titles.length !== prompts.length || titles.some(t => typeof t !== 'string' || !t.trim())) return
                titleCache.set(titleKey, titles); publish({})
              }).catch(() => {})
          }, [titleKey, needsTitles, repairedTitles, view?.candidatesPending, draft, running, predictionsHidden, props.sessionId])
          const options = prompts.map((prompt, index) => ({
            prompt,
            title: repairedTitles?.[index] || (titleNeedsRepair(view?.titles?.[index], prompt) ? prompt : view.titles[index]),
          }))
          const expanded = isExpanded(props.sessionId, view)
          const index = expanded ? Math.min(selected, Math.max(0, options.length - 1)) : 0
          const text = options[index]?.prompt ?? ''
          const available = options.length > 0 && !draft && !predictionsHidden
          const requestPrediction = () => {
            if (requesting.current?.sessionId === props.sessionId || live?.status === 'pending' || live?.candidatesPending || live?.summaryPending) return
            const request = { sessionId: props.sessionId }
            requesting.current = request
            setRequestNotice({ ...request, pending: true }); setBrowsing(null)
            Promise.resolve().then(() => ctx.remote.commands.execute(request.sessionId, '/companion-refresh', []))
              .then(result => {
                if (!result.ok) throw new Error(result.error?.message || '无法生成预测')
                if (result.value?.result?.kind === 'error') throw new Error(result.value.result.text)
                setRequestNotice({ ...request, pending: false })
              }).catch(error => setRequestNotice({ ...request, pending: false, error: error.message || String(error) }))
              .finally(() => { if (requesting.current === request) requesting.current = false })
          }
          // Pointer equivalents of the ← / → group keys, so phones can browse
          // earlier prediction groups and ask for a fresh one without a keyboard.
          const browseOlder = () => {
            const older = batches[Math.max(0, page - 1)]
            if (!older) return
            setBrowsing({ sessionId: props.sessionId, sourceSeq: live.sourceSeq, at: older.at })
            setSelected(0)
          }
          const browseNewer = () => {
            const newer = batches[page + 1]
            if (newer) {
              setBrowsing({ sessionId: props.sessionId, sourceSeq: live.sourceSeq, at: newer.at })
              setSelected(0)
              return
            }
            requestPrediction()
          }
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
          const focusEditor = () => (list.current ?? anchor.current)?.closest('[data-composer-card]')?.querySelector('[contenteditable="true"]')?.focus({ preventScroll: true })
          const dismiss = () => {
            const editor = list.current?.closest('[data-composer-card]')?.querySelector('[contenteditable="true"]')
            setSelected(0)
            if (!expanded) setPredictionsHidden(true)
            setExpanded(props.sessionId, view, false)
            editor?.focus({ preventScroll: true })
          }
          // The × icon hides the whole panel; it never has to be pressed twice
          // like Esc, which first collapses an expanded list.
          const hidePredictions = () => {
            setSelected(0)
            setExpanded(props.sessionId, view, false)
            setPredictionsHidden(true)
          }
          // Keep the composer from stealing focus and prevent the browser from
          // synthesizing a second activation from the same tap.
          const keepComposerFocus = event => event?.preventDefault?.()
          const generating = live?.status === 'pending' || live?.summaryPending
          // Adopt a candidate into the draft without sending it. Clicking is the
          // primary gesture; Tab stays as an accelerator for the selected one.
          const tap = useRef(null)
          const accept = (optionIndex, focus = true) => {
            if (!available || !props.inputActions) return false
            const value = options[optionIndex ?? index]?.prompt ?? text
            if (!value) return false
            if (optionIndex !== undefined) setSelected(optionIndex)
            const editor = list.current?.closest('[data-composer-card]')?.querySelector('[contenteditable="true"]')
            props.inputActions.setDraft(value)
            props.inputActions.persistDraft()
            if (focus) editor?.focus({ preventScroll: true })
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
              } else if (expanded && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault(); event.stopPropagation()
                setSelected((value) => (value + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
              } else if ((event.key === 'ArrowRight' || event.key === 'ArrowDown') && !expanded) {
                event.preventDefault(); event.stopPropagation()
                setSelected(0); setExpanded(props.sessionId, view, true)
              } else if (event.key === 'ArrowLeft' && expanded) {
                event.preventDefault(); event.stopPropagation()
                const older = batches[Math.max(0, page - 1)]
                if (older) { setBrowsing({ sessionId: props.sessionId, sourceSeq: live.sourceSeq, at: older.at }); setSelected(0) }
              } else if (event.key === 'ArrowRight' && expanded) {
                event.preventDefault(); event.stopPropagation()
                const newer = batches[page + 1]
                if (newer) {
                  setBrowsing({ sessionId: props.sessionId, sourceSeq: live.sourceSeq, at: newer.at })
                  setSelected(0)
                  return
                }
                requestPrediction()
              } else if (event.key === 'Tab') {
                // Consume before setting draft so the host cannot send this keypress.
                event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.()
                accept()
              }
            }
            window.addEventListener('keydown', onKey, true)
            return () => window.removeEventListener('keydown', onKey, true)
          }, [available, expanded, text, options.length, props.inputActions, props.sessionId, view, live, page, batches])
          useEffect(() => {
            if ((!predictionsHidden && options.length) || draft) return
            const reopen = event => {
              if (!['Tab', 'Escape'].includes(event.key) || event.repeat || event.isComposing || event.keyCode === 229 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
              const card = anchor.current?.closest('[data-composer-card]')
              if (!card || !(anchor.current?.contains?.(event.target) || (event.target?.isContentEditable && event.target.closest('[data-composer-card]') === card))) return
              if (event.key === 'Escape') {
                if (predictionsHidden) return
                event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.()
                setPredictionsHidden(true); return
              }
              event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.()
              expandedBatches.clear()
              setSelected(0)
              setPredictionsHidden(false)
              if (!options.length) requestPrediction()
            }
            window.addEventListener('keydown', reopen, true)
            return () => window.removeEventListener('keydown', reopen, true)
          }, [predictionsHidden, draft, running, props.sessionId, options.length, live])
          if (!available) {
            const status = !predictionsHidden && !draft && !options.length
              ? requestError || live?.error || (notice?.pending || live?.status === 'pending' ? '正在生成预测…' : '') : ''
            if (status) return h('div', { ref: anchor, role: 'region', 'aria-label': '下一句预测状态', style: { position: 'absolute', bottom: '100%', left: 0, right: 0, padding: '7px 8px 7px 12px', fontSize: 12, background: 'var(--dsw-alias-bg-elevated, #fff)', border: '1px solid var(--dsw-alias-border-subtle, #ddd)', borderRadius: 8, pointerEvents: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 } },
              h('span', { role: 'status' }, status),
              h('button', { type: 'button', title: '隐藏（Esc）', 'aria-label': '隐藏下一句预测', style: CSS.iconBtn, onMouseDown: keepComposerFocus, onClick: hidePredictions }, h(Icon, { name: 'hide' })))
            return h('span', { ref: anchor, hidden: true, 'aria-hidden': true })
          }
          return h(React.Fragment, null,
            h('style', null, `[data-composer-card]:has(.pc-predictions) [data-composer-placeholder]{visibility:hidden}[data-composer-card]:has(.pc-predictions) [data-input-scroll]{min-height:${height + 12}px;max-height:none}.pc-predictions:focus{outline:none}.pc-predictions [role="option"]:hover{background:var(--dsw-alias-bg-subtle, #f5f5f8)}.pc-predbar button:hover{background:var(--dsw-alias-bg-subtle, #f2f2f5)}.pc-predbar button:active{background:var(--dsw-alias-bg-subtle, #e8e8ee)}.pc-predbar button:disabled{opacity:.35;cursor:default;background:transparent}`),
            h('div', { ref: list, className: 'pc-predictions', onMouseDown: e => { if (e.target?.closest?.('button,[role="option"]')) return; e.preventDefault(); focusEditor() }, role: 'listbox', tabIndex: 0, 'aria-label': expanded ? '下一句预测，点击候选采用；图标可换组、重新生成、收起或隐藏' : '下一句预测，点击候选采用；图标可展开更多候选或隐藏', 'aria-activedescendant': 'pc-option-' + props.sessionId + '-' + index,
              style: { position: 'absolute', top: 10, left: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 2, pointerEvents: 'auto', background: 'var(--dsw-specific-input-major, #fff)', fontSize: 14 } },
              h('div', { className: 'pc-predbar', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 30, color: 'var(--dsw-alias-text-secondary, #888)', fontSize: 11 } },
                h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, expanded ? '下一句 · 第 ' + (page + 1) + '/' + batches.length + ' 组' : '下一句'),
                h('span', { style: { display: 'flex', alignItems: 'center', gap: 1, marginRight: -5 } },
                  h('button', { type: 'button', title: '采用（Tab）', 'aria-label': '采用当前候选', style: CSS.iconBtn, onMouseDown: keepComposerFocus, onClick: event => { event?.stopPropagation(); accept() } }, h(Icon, { name: 'accept' })),
                  expanded
                    ? h('button', { type: 'button', title: '上一组（←）', 'aria-label': '上一组预测', disabled: page <= 0, style: CSS.iconBtn, onMouseDown: keepComposerFocus, onClick: event => { event?.stopPropagation(); browseOlder() } }, h(Icon, { name: 'older' }))
                    : h('button', { type: 'button', title: '更多候选（↓ / →）', 'aria-label': '展开更多候选', style: CSS.iconBtn, onMouseDown: keepComposerFocus, onClick: event => { event?.stopPropagation(); setSelected(0); setExpanded(props.sessionId, view, true) } }, h(Icon, { name: 'more' })),
                  expanded
                    ? h('button', { type: 'button', title: page < batches.length - 1 ? '下一组（→）' : generating ? '正在生成新的一组' : '换一组（→）', 'aria-label': page < batches.length - 1 ? '下一组预测' : '重新生成预测', disabled: generating, style: CSS.iconBtn, onMouseDown: keepComposerFocus, onClick: event => { event?.stopPropagation(); if (!generating) browseNewer() } }, h(Icon, { name: page < batches.length - 1 ? 'newer' : 'refresh' }))
                    : null,
                  expanded
                    ? h('button', { type: 'button', title: '收起（Esc）', 'aria-label': '收起预测', style: CSS.iconBtn, onMouseDown: keepComposerFocus, onClick: event => { event?.stopPropagation(); dismiss() } }, h(Icon, { name: 'less' }))
                    : null,
                  h('button', { type: 'button', title: '隐藏（Esc）', 'aria-label': '隐藏下一句预测', style: CSS.iconBtn, onMouseDown: keepComposerFocus, onClick: event => { event?.stopPropagation(); hidePredictions() } }, h(Icon, { name: 'hide' })))),
              live?.status === 'pending' ? h('div', { role: 'status', style: { fontSize: 12 } }, '正在生成新的一组，旧建议仍可查看…') : null,
              live?.manualDuringTurn ? h('div', { style: { fontSize: 11, color: 'var(--dsw-alias-text-secondary, #888)' } }, '基于触发时的上下文，主回复可能仍在更新') : null,
              live?.candidatesPending ? h('div', { role: 'status', style: { fontSize: 11, color: 'var(--dsw-alias-text-secondary, #888)' } }, '其余候选生成中，已完成的可采用') : null,
              (requestError || live?.error) ? h('div', { role: 'status', style: { fontSize: 12, color: '#b42318' } }, requestError || live.error) : null,
              ...(expanded ? options : options.slice(0, 1)).map((option, i) => h('div', { key: i, id: 'pc-option-' + props.sessionId + '-' + i, role: 'option', 'aria-selected': i === index, title: '点击采用：只填入草稿，不发送',
                onPointerDown: e => {
                  tap.current = null
                  if (e.pointerType !== 'touch') return
                  e.preventDefault(); e.stopPropagation()
                  tap.current = { id: e.pointerId, x: e.clientX, y: e.clientY, index: i }
                },
                onPointerCancel: () => { if (tap.current) tap.current.cancelled = true },
                onPointerUp: e => {
                  const t = tap.current
                  if (e.pointerType !== 'touch' || !t || t.id !== e.pointerId) return
                  e.preventDefault(); e.stopPropagation()
                  t.done = true
                  if (!t.cancelled && t.index === i && Math.hypot(e.clientX-t.x, e.clientY-t.y) <= 10) accept(i, false)
                },
                onMouseDown: e => { e.preventDefault(); e.stopPropagation() },
                onClick: e => {
                  e?.stopPropagation()
                  if (tap.current) { e?.preventDefault(); return }
                  accept(i)
                },
                style: { padding: '7px 10px', borderRadius: 8, border: i === index ? '1px solid var(--dsw-alias-border-subtle, #dedee7)' : '1px solid transparent', background: i === index ? 'var(--dsw-alias-bg-subtle, #f5f5f8)' : undefined, cursor: 'pointer', color: i === index ? 'var(--dsw-alias-text-primary, #333)' : 'var(--dsw-alias-text-secondary, #888)' } },
                h('div', { style: { fontWeight: i === index ? 600 : 400, lineHeight: '20px', overflowWrap: 'anywhere' } }, (i + 1) + '. ' + option.title),
                i === index ? h('div', { style: { marginTop: 5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.6, fontWeight: 400 } }, option.prompt) : null))))
        }
        function DraftReview(props) {
          const draft = props.useInput(input => input?.draft ?? '')
          const running = props.useSession(session => session?.running ?? false)
          const [result, setResult] = useState(null)
          const anchor = useRef(null)
          const tracker = useRef({ sessionId: props.sessionId, text: draft, checked: draft, added: 0, revision: 0 })
          const latest = useRef(null)
          const composing = useRef(false)
          const manualTimer = useRef(null)
          latest.current = { draft, sessionId: props.sessionId, running }
          useEffect(() => {
            const belongs = e => e.target?.closest?.('[data-composer-card]') === anchor.current?.closest('[data-composer-card]')
            const start = e => { if (belongs(e)) composing.current = true }
            const end = e => { if (belongs(e)) composing.current = false }
            window.addEventListener('compositionstart', start, true)
            window.addEventListener('compositionend', end, true)
            return () => { window.removeEventListener('compositionstart', start, true); window.removeEventListener('compositionend', end, true) }
          }, [])
          useEffect(() => () => {
            tracker.current.revision++
            clearTimeout(manualTimer.current); manualTimer.current = null
          }, [draft, props.sessionId])
          useEffect(() => {
            if (!running) return
            if (!tracker.current.manual) { tracker.current.revision++; setResult(null) }
          }, [running])
          const checkDraft = async (mode = 'basic', manual = false) => {
            const state = tracker.current
            if (latest.current.draft !== draft || latest.current.sessionId !== props.sessionId || (latest.current.running && !manual) || composing.current || !draft.trim()) return
            const revision = ++state.revision
            state.added = 0; state.checked = draft; state.manual = manual
            const base = { draft, sessionId: props.sessionId, mode, manual }
            if (draft.length > 12000) { setResult({ ...base, error: '输入超过 12000 字符，暂不检查' }); return }
            setResult({ ...base, pending: true })
            try {
              const response = await ctx.remote.commands.execute(props.sessionId, '/companion-review ' + JSON.stringify({ draft, mode }), [])
              if (!response.ok || response.value?.result?.kind !== 'success') throw new Error(response.value?.result?.text || '暂时无法检查输入')
              const { edits } = JSON.parse(response.value.result.text)
              if (!Array.isArray(edits)) throw new Error('纠错结果无效')
              if (tracker.current !== state || state.revision !== revision || latest.current.draft !== draft || latest.current.sessionId !== props.sessionId || (latest.current.running && !manual)) return
              setResult(edits.length ? { ...base, edits } : { ...base, clean: true })
            } catch (error) {
              if (tracker.current === state && state.revision === revision) setResult({ ...base, error: error.message })
            }
          }

          useEffect(() => {
            let state = tracker.current
            if (state.sessionId !== props.sessionId) state = tracker.current = { sessionId: props.sessionId, text: draft, checked: draft, added: 0, revision: state.revision + 1 }
            // Editing only invalidates stale suggestions. Checks are explicitly
            // requested by Shift+Tab; no idle or character-count scheduler.
            state.text = draft; state.manual = false
            state.revision++
            setResult(null)
          }, [draft, props.sessionId])

          useEffect(() => {
            if (!result?.clean) return
            const timer = setTimeout(() => setResult(null), 2500)
            return () => clearTimeout(timer)
          }, [result])
          const visible = result && result.draft === draft && result.sessionId === props.sessionId && (!running || result.manual)
          const dismiss = () => { tracker.current.revision++; clearTimeout(manualTimer.current); manualTimer.current = null; setResult(null) }
          const accept = () => {
            if (!visible || !result.edits?.length || latest.current.draft !== result.draft) return
            let text = draft
            for (const edit of [...result.edits].reverse()) text = text.slice(0, edit.start) + edit.after + text.slice(edit.end)
            tracker.current.text = text; tracker.current.checked = text; tracker.current.added = 0
            dismiss()
            props.inputActions.setDraft(text); props.inputActions.persistDraft()
            anchor.current?.closest('[data-composer-card]')?.querySelector('[contenteditable="true"]')?.focus({ preventScroll: true })
          }
          useEffect(() => {
            const onKey = event => {
              if (event.repeat || event.isComposing || composing.current || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return
              const card = anchor.current?.closest('[data-composer-card]')
              if (!card || !(anchor.current?.contains(event.target) || (event.target?.isContentEditable && event.target.closest('[data-composer-card]') === card))) return
              if (event.key === 'Tab' && event.shiftKey && draft.trim()) {
                event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.()
                tracker.current.revision++
                setResult(null)
                if (manualTimer.current !== null) {
                  clearTimeout(manualTimer.current); manualTimer.current = null
                  void checkDraft('deep', true)
                } else {
                  manualTimer.current = setTimeout(() => { manualTimer.current = null; void checkDraft('basic', true) }, 450)
                }
                return
              }
              if (event.shiftKey) return
              if (event.key === 'Escape' && manualTimer.current !== null) {
                event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); dismiss(); return
              }
              if (!visible || (event.key !== 'Escape' && !(event.key === 'Tab' && result.edits?.length))) return
              event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.()
              if (event.key === 'Escape') dismiss(); else accept()
            }
            window.addEventListener('keydown', onKey, true)
            return () => window.removeEventListener('keydown', onKey, true)
          }, [visible, result, draft, props.inputActions, props.sessionId, running])
          if (!visible) return h('span', { ref: anchor, hidden: true })
          const chunks = []
          let offset = 0
          for (const edit of result.edits ?? []) {
            chunks.push(draft.slice(offset, edit.start))
            // Trim shared context so only the actual changed characters are colored.
            let a = 0, b = 0
            while (a < edit.before.length && a < edit.after.length && edit.before[a] === edit.after[a]) a++
            while (b < edit.before.length-a && b < edit.after.length-a && edit.before.at(-1-b) === edit.after.at(-1-b)) b++
            chunks.push(edit.before.slice(0,a))
            chunks.push(h('del', { title: edit.reason, style: { color: '#b42318', background: '#fee4e2' } }, edit.before.slice(a,edit.before.length-b)))
            chunks.push(h('ins', { title: edit.reason, style: { color: '#067647', background: '#dcfae6', textDecoration: 'underline' } }, edit.after.slice(a,edit.after.length-b)))
            chunks.push(b ? edit.before.slice(-b) : '')
            offset = edit.end
          }
          chunks.push(draft.slice(offset))
          const reason = result.mode === 'deep' ? [...new Set((result.edits ?? []).map(e => e.reason).filter(Boolean))].join('；') : ''
          const reasonId = 'pc-review-reason-' + props.sessionId
          const smallButton = { ...CSS.btn, fontSize: 11, padding: '2px 6px', border: 'none', borderRadius: 4 }
          return h('section', { ref: anchor, className: 'pc-draft-review', 'aria-label': '输入纠错建议', style: { position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, padding: '7px 10px', fontSize: 12, lineHeight: 1.5, border: '1px solid var(--dsw-alias-border-subtle, #ddd)', borderRadius: 9, background: 'var(--dsw-alias-bg-elevated, #fff)', color: 'var(--dsw-alias-text-primary, #222)', boxShadow: '0 2px 10px #0001', pointerEvents: 'auto', zIndex: 4 } },
            h('style', null, '.pc-review-reason-tip{visibility:hidden;opacity:0;pointer-events:none}.pc-review-reason:hover .pc-review-reason-tip,.pc-review-reason:focus-within .pc-review-reason-tip{visibility:visible;opacity:1;pointer-events:auto}'),
            h('div', { style: CSS.row }, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5 } }, h('span', { role: 'status', style: { fontSize: 11, color: 'var(--dsw-alias-text-secondary, #777)' } }, result.pending ? (result.mode === 'deep' ? '正在深度改写…' : '正在检查输入…') : result.clean ? (result.mode === 'deep' ? '暂无进一步改写建议' : '未发现明显笔误') : result.error ? '输入检查' : result.mode === 'deep' ? '深度改写 · 可能调整意图' : '建议修改 · 红删绿增'),
              reason ? h('span', { className: 'pc-review-reason', style: { display: 'inline-flex', alignItems: 'center' } },
                h('button', { type: 'button', 'aria-label': '查看改写理由', 'aria-describedby': reasonId, style: { ...smallButton, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, padding: 0, color: 'var(--dsw-alias-text-secondary, #777)' } },
                  h('svg', { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', 'aria-hidden': true }, h('circle', { cx: 8, cy: 8, r: 6.25 }), h('path', { d: 'M8 7v4M8 4.5v1', strokeWidth: 1.4 }))),
                h('span', { id: reasonId, role: 'tooltip', className: 'pc-review-reason-tip', style: { position: 'absolute', bottom: '100%', left: 0, width: 'min(460px, 100%)', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-subtle, #ddd)', background: 'var(--dsw-alias-bg-elevated, #fff)', color: 'var(--dsw-alias-text-secondary, #777)', fontSize: 11, lineHeight: 1.6, overflowWrap: 'anywhere', maxHeight: 'min(220px, 35vh)', overflowY: 'auto', boxShadow: '0 3px 12px #0002', zIndex: 5 } }, reason)) : null),
              h('span', null, result.edits?.length ? h('button', { style: smallButton, onClick: accept, onMouseDown: e => e.preventDefault() }, '采用 · Tab') : null,
                h('button', { style: smallButton, onClick: dismiss, onMouseDown: e => e.preventDefault() }, '关闭 · Esc'))),
            result.error ? h('div', { role: 'status', style: CSS.hint }, result.error) : result.edits?.length ? h('div', { style: { marginTop: 4, maxHeight: 'min(180px, 25vh)', overflowY: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5, fontSize: 12 } }, ...chunks) : null)
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
        ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({ name: 'conversation.chat.commandview', key: 'companion-review' }, ReviewRound))
        ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({ name: 'conversation.input.overlay', id: 'copilot-ghost', order: 5 }, Suggestions))
        ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({ name: 'conversation.input.overlay', id: 'copilot-review', order: 6 }, DraftReview))
        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({ name: 'conversation.input.left', id: 'copilot-wand', order: 5 }, SummaryButton))
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'copilot-dialog' }, Overlay))
      },
    }
  },
})
