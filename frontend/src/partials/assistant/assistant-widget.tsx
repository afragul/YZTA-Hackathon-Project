import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api-client';
import { toAbsoluteUrl } from '@/lib/helpers';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantResponse {
  reply: string;
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setDraft('');
    setLoading(true);

    try {
      const res = await apiRequest<AssistantResponse>('/assistant/chat', {
        method: 'POST',
        body: { messages: updated },
      });
      setMessages([...updated, { role: 'assistant', content: res.reply }]);
    } catch {
      setMessages([
        ...updated,
        { role: 'assistant', content: 'Bir hata oluştu, tekrar deneyin.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-16 right-6 z-50 size-40 rounded-full bg-transparent flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          title="Akıllı Asistan"
        >
          <img
            src={toAbsoluteUrl('/media/app/kobaimascot.png')}
            alt="Kobai Asistan"
            className="size-40 object-contain drop-shadow-xl"
          />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-primary/5">
            <img
              src={toAbsoluteUrl('/media/app/kobaimascot.png')}
              alt="Kobai"
              className="size-8 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Kobai Asistan</p>
              <p className="text-xs text-muted-foreground">
                Sipariş, stok, kargo hakkında sor
              </p>
            </div>
            <Button
              variant="ghost"
              mode="icon"
              size="sm"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Bot className="size-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">Merhaba!</p>
                <p className="text-xs mt-1 max-w-[240px]">
                  Sipariş durumu, stok bilgisi, kargo takibi gibi konularda
                  yardımcı olabilirim.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm',
                  )}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  ) : (
                    <div
                      className={cn(
                        'leading-relaxed break-words',
                        // Markdown styling
                        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
                        '[&_p]:my-1.5',
                        '[&_strong]:font-semibold [&_strong]:text-foreground',
                        '[&_em]:italic',
                        '[&_ul]:list-disc [&_ul]:ms-5 [&_ul]:my-1.5 [&_ul]:space-y-0.5',
                        '[&_ol]:list-decimal [&_ol]:ms-5 [&_ol]:my-1.5 [&_ol]:space-y-0.5',
                        '[&_li]:marker:text-muted-foreground',
                        '[&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-2 [&_h1]:mb-1',
                        '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1',
                        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-1.5 [&_h3]:mb-0.5',
                        '[&_code]:bg-background/70 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono',
                        '[&_pre]:bg-background/70 [&_pre]:p-2 [&_pre]:rounded-md [&_pre]:my-2 [&_pre]:overflow-x-auto',
                        '[&_pre>code]:bg-transparent [&_pre>code]:p-0',
                        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
                        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:ps-2 [&_blockquote]:my-1.5 [&_blockquote]:text-muted-foreground',
                        '[&_hr]:my-2 [&_hr]:border-border',
                        '[&_table]:my-2 [&_table]:text-xs',
                        '[&_th]:font-semibold [&_th]:px-2 [&_th]:py-1 [&_th]:border [&_th]:border-border',
                        '[&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-border',
                      )}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node: _node, ...props }) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="border-t border-border px-3 py-2.5 flex items-end gap-2"
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Bir şey sor..."
              rows={1}
              className="resize-none min-h-[36px] max-h-[80px] grow text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(e as unknown as FormEvent);
                }
              }}
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !draft.trim()}
              mode="icon"
              size="sm"
              className="shrink-0"
            >
              <Send className="size-3.5" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
