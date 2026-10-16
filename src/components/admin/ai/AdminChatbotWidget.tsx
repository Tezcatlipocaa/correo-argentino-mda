import React, { useState, useRef, useEffect } from "react";
import {
  XMarkIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import {
  SparklesIcon as SparklesSolidIcon,
  BuildingOffice2Icon,
  BoltIcon,
  CommandLineIcon,
} from "@heroicons/react/24/solid";
import {
  type ChatMessage,
  INITIAL_QUICK_PROMPTS,
  INITIAL_GREETING,
} from "./types";

const STORAGE_KEY_MESSAGES = "mda_admin_chatbot_messages";
const STORAGE_KEY_OPEN = "mda_admin_chatbot_open";

export default function AdminChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const isHydratedRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeBotMsgIdRef = useRef<string | null>(null);

  const stopActiveOperations = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTyping(false);
    setIsStreaming(false);
    activeBotMsgIdRef.current = null;
  };

  useEffect(() => {
    try {
      const storedOpen = sessionStorage.getItem(STORAGE_KEY_OPEN);
      if (storedOpen === "true") {
        setIsOpen(true);
      }

      const storedMessages = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validMessages: ChatMessage[] = parsed.map((m: any) => ({
            id: String(m.id),
            sender: m.sender === "user" ? "user" : "assistant",
            text: String(m.text || ""),
            timestamp: new Date(m.timestamp),
          }));
          setMessages(validMessages);
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY_MESSAGES);
      sessionStorage.removeItem(STORAGE_KEY_OPEN);
      setMessages([INITIAL_GREETING]);
    } finally {
      isHydratedRef.current = true;
    }

    return () => {
      stopActiveOperations();
    };
  }, []);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY_OPEN, String(isOpen));
    } catch {}
  }, [isOpen]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, isStreaming]);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleReset = () => {
    stopActiveOperations();
    const resetGreeting: ChatMessage = {
      ...INITIAL_GREETING,
      timestamp: new Date(),
    };
    setMessages([resetGreeting]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    try {
      sessionStorage.setItem(
        STORAGE_KEY_MESSAGES,
        JSON.stringify([resetGreeting]),
      );
    } catch {}
  };

  const handleStop = () => {
    stopActiveOperations();
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (
      typeof textToSend === "string" ? textToSend : inputValue
    ).trim();
    if (!text || isTyping || isStreaming) return;

    const userMsg: ChatMessage = {
      id: "user-" + Date.now(),
      sender: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsTyping(true);

    const matchedPrompt = INITIAL_QUICK_PROMPTS.find(
      (p) =>
        p.query.toLowerCase() === text.toLowerCase() ||
        p.label.toLowerCase() === text.toLowerCase(),
    );

    const responseText = matchedPrompt
      ? matchedPrompt.response
      : "Esta funcionalidad estará disponible próximamente en Referente.";

    stopActiveOperations();
    setIsTyping(true);

    timerRef.current = setTimeout(() => {
      setIsTyping(false);
      setIsStreaming(true);

      const botMsgId = "assistant-" + Date.now();
      activeBotMsgIdRef.current = botMsgId;

      const botMsg: ChatMessage = {
        id: botMsgId,
        sender: "assistant",
        text: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);

      const words = responseText.split(" ");
      let currentWordIndex = 0;

      intervalRef.current = setInterval(() => {
        if (currentWordIndex < words.length) {
          const nextChunk =
            (currentWordIndex === 0 ? "" : " ") + words[currentWordIndex];
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId
                ? { ...msg, text: msg.text + nextChunk }
                : msg,
            ),
          );
          currentWordIndex++;
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsStreaming(false);
          activeBotMsgIdRef.current = null;
        }
      }, 15);
    }, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderPromptIcon = (iconName: string) => {
    switch (iconName) {
      case "office":
        return <BuildingOffice2Icon className="text-info size-4 shrink-0" />;
      case "automations":
        return <BoltIcon className="text-warning size-4 shrink-0" />;
      case "capabilities":
      default:
        return <CommandLineIcon className="text-accent size-4 shrink-0" />;
    }
  };

  const getPromptButtonClasses = (iconName: string) => {
    switch (iconName) {
      case "office":
        return "border-info/30 hover:border-info hover:bg-info/10";
      case "automations":
        return "border-warning/30 hover:border-warning hover:bg-warning/10";
      case "capabilities":
      default:
        return "border-accent/30 hover:border-accent hover:bg-accent/10";
    }
  };

  return (
    <>
      <div
        className={`border-base-300 bg-base-100 fixed right-6 bottom-24 z-50 flex h-125 w-96 origin-bottom-right flex-col overflow-hidden rounded-2xl border shadow-2xl transition-all duration-200 ease-out ${
          isOpen
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="border-base-300 bg-base-200/50 flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <div className="avatar placeholder">
              <div className="bg-secondary text-secondary-content flex size-9 items-center justify-center rounded-full shadow-sm">
                <SparklesSolidIcon className="size-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base-content text-sm font-semibold">
                  Referente
                </h3>
              </div>
              <p className="text-base-content/60 text-small">
                Asistente virtual MDA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-ghost btn-circle btn-xs text-base-content/70 hover:text-base-content"
              aria-label="Reiniciar conversación"
              title="Reiniciar conversación"
            >
              <ArrowPathIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn btn-ghost btn-circle btn-xs text-base-content/70 hover:text-base-content"
              aria-label="Cerrar asistente de IA"
              title="Cerrar"
            >
              <XMarkIcon className="size-4" />
            </button>
          </div>
        </div>

        <div className="scrollbar-hide flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat ${msg.sender === "user" ? "chat-end" : "chat-start"}`}
            >
              <div className="chat-header text-xxs mb-0.5 flex items-center gap-1.5 opacity-60">
                <span>{msg.sender === "user" ? "Tú" : "Referente"}</span>
              </div>

              <div
                className={`chat-bubble text-xs ${
                  msg.sender === "user"
                    ? "chat-bubble-secondary text-secondary-content"
                    : "bg-base-200 text-base-content"
                }`}
              >
                {msg.text || (
                  <span className="loading loading-dots loading-xs"></span>
                )}
              </div>
              <div className="chat-footer text-xxs mt-0.5 opacity-60">
                <time>{formatTime(new Date(msg.timestamp))}</time>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="chat chat-start">
              <div className="chat-header text-xxs mb-0.5 flex items-center gap-1.5 opacity-60">
                <span>Referente</span>
              </div>
              <div className="chat-bubble bg-base-200 text-base-content text-xs">
                <span className="loading loading-dots loading-xs"></span>
              </div>
            </div>
          )}

          {messages.length === 1 && !isTyping && !isStreaming && (
            <div className="space-y-1.5 pt-2">
              <p className="text-base-content/60 text-small font-medium">
                Consultas sugeridas:
              </p>
              <div className="flex flex-col gap-1.5">
                {INITIAL_QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    onClick={() => handleSendMessage(prompt.query)}
                    className={`btn btn-outline btn-xs h-auto justify-start gap-2 px-2.5 py-1.5 text-left normal-case transition-colors ${getPromptButtonClasses(
                      prompt.iconName,
                    )}`}
                  >
                    {renderPromptIcon(prompt.iconName)}
                    <span className="text-base-content truncate font-medium">
                      {prompt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isStreaming) {
              handleSendMessage();
            }
          }}
          className="border-base-300 bg-base-100 flex items-end gap-2 border-t p-3"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? "Referente está respondiendo..."
                : "Escribe tu consulta... (Enter para enviar)"
            }
            className="textarea textarea-bordered textarea-sm scrollbar-hide max-h-20 min-h-9.5 flex-1 resize-none py-2 text-xs leading-tight"
            disabled={isTyping || isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="btn btn-error btn-sm btn-circle shrink-0"
              aria-label="Detener respuesta"
              title="Detener respuesta"
            >
              <StopIcon className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="btn btn-secondary btn-sm btn-circle shrink-0"
              aria-label="Enviar mensaje"
              title="Enviar mensaje"
            >
              <PaperAirplaneIcon className="size-4" />
            </button>
          )}
        </form>
      </div>

      <div className="fab fixed right-6 bottom-6 z-50">
        <div className="group">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="btn btn-circle btn-secondary btn-lg shadow-secondary/25 hover:shadow-secondary/50 relative shadow-xl transition-all duration-300 group-hover:scale-105"
            aria-label={
              isOpen
                ? "Cerrar asistente Referente"
                : "Abrir asistente Referente"
            }
            title="Referente"
          >
            {isOpen ? (
              <XMarkIcon className="size-7 transition-transform duration-200" />
            ) : (
              <span className="relative flex items-center justify-center">
                <SparklesSolidIcon className="text-secondary-content size-7 transition-transform duration-300 group-hover:rotate-12" />
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export { AdminChatbotWidget };
