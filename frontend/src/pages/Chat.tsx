import { useMemo, useState, useEffect, useRef } from 'react'
import { Hash, Info, MessageSquare, Phone, Search, Send, User, Video } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { SearchInput } from '../components/ui/SearchInput'
import { useCreate, useList, useLookup } from '../hooks/useData'
import { useAuthStore } from '../store/useAuthStore'
import { cx, dateFa, dateTimeFa } from '../utils/format'
import type { ChatRoom, ChatMessage } from '../types'

export default function Chat() {
  const me = useAuthStore(s => s.user)
  const { data: rooms } = useList('rooms')
  const { data: messages } = useList('messages')
  const { map: users } = useLookup('users')
  
  const [q, setQ] = useState('')
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  
  const createMessage = useCreate('messages', { success: false }) // silent creation
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  // My rooms
  const myRooms = useMemo(() => {
    return rooms.filter(r => r.members.includes(me?.id || '')).filter(r => {
      if (!q) return true
      const otherUser = r.type === 'dm' ? users.get(r.members.find(m => m !== me?.id) || '') : null
      const name = r.type === 'dm' ? otherUser?.name || 'ناشناس' : r.name
      return name.toLowerCase().includes(q.toLowerCase())
    })
  }, [rooms, me?.id, q, users])

  const activeRoom = myRooms.find(r => r.id === activeRoomId)
  
  const roomMessages = useMemo(() => {
    if (!activeRoomId) return []
    return messages
      .filter(m => m.roomId === activeRoomId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [messages, activeRoomId])

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [roomMessages])

  // Select first room by default
  useEffect(() => {
    if (!activeRoomId && myRooms.length > 0) {
      setActiveRoomId(myRooms[0].id)
    }
  }, [myRooms, activeRoomId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !activeRoomId || !me) return

    const t = text
    setText('')

    await createMessage.mutateAsync({
      roomId: activeRoomId,
      senderId: me.id,
      text: t,
      date: new Date().toISOString()
    })
  }

  const getRoomMeta = (r: ChatRoom) => {
    if (r.type === 'dm') {
      const otherId = r.members.find(m => m !== me?.id)
      const other = users.get(otherId || '')
      return {
        name: other?.name || 'ناشناس',
        subtitle: other?.title || 'کارمند',
        icon: <Avatar name={other?.name || '?'} size="sm" />
      }
    }
    return {
      name: r.name,
      subtitle: `${r.members.length} عضو`,
      icon: <div className="avatar placeholder"><div className="bg-neutral text-neutral-content rounded-full w-10"><Hash className="size-5" /></div></div>
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-h-screen">
      <div className="card bg-base-100 shadow-sm border border-base-200 flex-1 flex lg:flex-row flex-col overflow-hidden">
        
        {/* Sidebar */}
        <div className={cx(
          "flex-1 lg:max-w-xs border-e border-base-200 flex flex-col",
          activeRoomId ? "hidden lg:flex" : "flex"
        )}>
          <div className="p-4 border-b border-base-200">
            <h2 className="font-bold text-lg mb-4">گفتگوها</h2>
            <SearchInput 
              placeholder="جستجوی گفتگو..." 
              value={q} 
              onChange={setQ} 
              className="w-full" 
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {myRooms.length === 0 ? (
              <div className="p-4 text-center text-sm text-base-content/50 mt-4">
                گفتگویی یافت نشد.
              </div>
            ) : (
              myRooms.map(r => {
                const meta = getRoomMeta(r)
                return (
                  <button
                    key={r.id}
                    className={cx(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-right",
                      activeRoomId === r.id ? "bg-base-200" : "hover:bg-base-200/50"
                    )}
                    onClick={() => setActiveRoomId(r.id)}
                  >
                    <div className="indicator">
                      {r.unread > 0 && <span className="indicator-item badge badge-primary badge-sm p-1 px-1.5">{r.unread}</span>}
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{meta.name}</div>
                      <div className="text-xs text-base-content/60 truncate">{meta.subtitle}</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={cx(
          "flex-[2] flex flex-col bg-base-50/30",
          !activeRoomId ? "hidden lg:flex" : "flex"
        )}>
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center text-base-content/40">
              <MessageSquare className="size-16 mb-4 opacity-50" />
              <p>یک گفتگو برای شروع انتخاب کنید</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-base-200 bg-base-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button className="btn btn-circle btn-sm btn-ghost lg:hidden" onClick={() => setActiveRoomId(null)}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {getRoomMeta(activeRoom).icon}
                  <div>
                    <div className="font-bold">{getRoomMeta(activeRoom).name}</div>
                    <div className="text-xs text-base-content/60">{getRoomMeta(activeRoom).subtitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="btn btn-circle btn-sm btn-ghost text-base-content/70"><Phone className="size-4" /></button>
                  <button className="btn btn-circle btn-sm btn-ghost text-base-content/70"><Video className="size-4" /></button>
                  <button className="btn btn-circle btn-sm btn-ghost text-base-content/70"><Info className="size-4" /></button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {roomMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-base-content/40">
                    پیامی در این گفتگو وجود ندارد.
                  </div>
                ) : (
                  roomMessages.map((m) => {
                    const isMe = m.senderId === me?.id
                    const sender = users.get(m.senderId)
                    
                    return (
                      <div key={m.id} className={cx("chat", isMe ? "chat-end" : "chat-start")}>
                        {!isMe && (
                          <div className="chat-image avatar">
                            <Avatar name={sender?.name || '?'} size="sm" />
                          </div>
                        )}
                        <div className="chat-header text-xs mb-1 opacity-70">
                          {isMe ? 'شما' : sender?.name}
                          <time className="text-xs opacity-50 ms-2">{dateTimeFa(m.date)}</time>
                        </div>
                        <div className={cx("chat-bubble", isMe ? "chat-bubble-primary text-primary-content" : "chat-bubble-neutral")}>
                          {m.text}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-base-200 bg-base-100">
                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <textarea 
                      className="textarea textarea-bordered w-full pe-12 min-h-[3rem] h-[3rem] max-h-32 resize-none leading-relaxed pt-3" 
                      placeholder="پیام خود را بنویسید..." 
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend(e)
                        }
                      }}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-square h-[3rem] w-[3rem]" 
                    disabled={!text.trim() || createMessage.isPending}
                  >
                    <Send className="size-5 ms-1" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
