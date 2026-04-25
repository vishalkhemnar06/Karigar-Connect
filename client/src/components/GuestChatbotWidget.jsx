import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, MessageCircle, Send, UserCheck, X } from 'lucide-react';
import { getGuestChatbotSuggestions, queryGuestChatbot } from '../api';

const SUPPORTED_UI_LANGUAGES = new Set(['en', 'hi', 'mr']);

const getPreferredUiLanguage = () => {
    const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([a-z]{2})/i);
    const lang = (match?.[1] || 'en').toLowerCase();
    return SUPPORTED_UI_LANGUAGES.has(lang) ? lang : 'en';
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const ROLE_OPTIONS = [
    { key: 'worker', label: 'Worker' },
    { key: 'client', label: 'Client' },
    { key: 'shop', label: 'Shop Owner' },
];

const starterMessage = 'Hi, welcome to KarigarConnect public assistant. Please choose your role first: Worker, Client, or Shop Owner.';

export default function GuestChatbotWidget() {
    const navigate = useNavigate();
    const location = useLocation();

    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [messages, setMessages] = useState([
        {
            id: makeId(),
            role: 'bot',
            text: starterMessage,
            actions: [
                { label: 'FAQ', route: '/faq' },
                { label: 'About', route: '/home#about-us' },
                { label: 'Terms', route: '/terms-and-conditions' },
                { label: 'Privacy', route: '/privacy-policy' },
            ],
        },
    ]);

    const language = useMemo(() => getPreferredUiLanguage(), []);
    const listRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        let active = true;

        const load = async () => {
            try {
                const { data } = await getGuestChatbotSuggestions(language);
                if (!active) return;
                setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 6) : []);
            } catch {
                if (active) setSuggestions([]);
            }
        };

        load();
        return () => {
            active = false;
        };
    }, [isOpen, language]);

    useEffect(() => {
        if (!listRef.current) return;
        listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages, isOpen]);

    const selectRole = async (roleKey) => {
        setSelectedRole(roleKey);
        await sendMessage(`I am a ${roleKey}.`);
    };

    const handleActionClick = (route = '/home') => {
        if (route.includes('#')) {
            window.location.href = route;
            return;
        }
        navigate(route);
        setIsOpen(false);
    };

    const sendMessage = async (raw = '') => {
        const question = String(raw || input).trim();
        if (!question || isSending) return;

        const userMessage = { id: makeId(), role: 'user', text: question, actions: [] };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsSending(true);

        try {
            const { data } = await queryGuestChatbot({
                message: question,
                preferredLanguage: language,
                role: selectedRole,
                currentRoute: location.pathname,
                conversation: messages.slice(-8).map((m) => ({ role: m.role, text: m.text })),
            });

            if (data?.role && data.role !== selectedRole) {
                setSelectedRole(data.role);
            }

            const text = String(data?.answer || data?.message || 'Unable to process your request right now.').trim();
            const botMessage = {
                id: makeId(),
                role: 'bot',
                text,
                actions: Array.isArray(data?.actions) ? data.actions.slice(0, 6) : [],
            };
            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            const errText = error?.response?.data?.message || 'Unable to process your request right now.';
            setMessages((prev) => [...prev, { id: makeId(), role: 'bot', text: errText, actions: [] }]);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            <motion.button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="fixed bottom-18 right-3 sm:bottom-22 sm:right-6 z-[35] h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-xl border border-white/30 flex items-center justify-center"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.96 }}
                aria-label="Open guest chatbot"
            >
                {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-28 right-2 sm:bottom-36 sm:right-6 z-[35] w-[calc(100vw-0.75rem)] sm:w-[min(88vw,22rem)] max-w-[22rem] max-h-[calc(100vh-13rem)] overflow-hidden rounded-2xl border border-blue-200/70 bg-white/95 shadow-2xl backdrop-blur flex flex-col"
                    >
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-3 py-2.5 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Bot size={16} />
                                    <p className="text-xs sm:text-sm font-bold">Guest Assistant</p>
                                </div>
                                {selectedRole && (
                                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                                        {ROLE_OPTIONS.find((r) => r.key === selectedRole)?.label}
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-[10px] text-blue-100">Public info only</p>
                        </div>

                        <div className="border-b border-blue-100 bg-blue-50/80 px-2.5 py-2">
                            <div className="flex flex-wrap gap-1.5">
                                {ROLE_OPTIONS.map((role) => (
                                    <button
                                        type="button"
                                        key={role.key}
                                        onClick={() => selectRole(role.key)}
                                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${selectedRole === role.key ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-200 hover:border-blue-400'}`}
                                    >
                                        <span className="inline-flex items-center gap-1"><UserCheck size={12} />{role.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div ref={listRef} className="max-h-[34vh] sm:max-h-[19rem] min-h-[9.5rem] sm:min-h-[12rem] overflow-y-auto px-2.5 py-2.5 space-y-2">
                            {messages.map((m) => (
                                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[88%] rounded-2xl px-2.5 py-2 text-[13px] sm:text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                                        {m.text}
                                        {m.role === 'bot' && Array.isArray(m.actions) && m.actions.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {m.actions.map((action, idx) => (
                                                    <button
                                                        type="button"
                                                        key={`${m.id}-${idx}`}
                                                        onClick={() => handleActionClick(action.route)}
                                                        className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:border-blue-500"
                                                    >
                                                        {action.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isSending && (
                                <div className="flex justify-start">
                                    <div className="rounded-2xl bg-gray-100 px-3 py-2 text-xs text-gray-600">Thinking...</div>
                                </div>
                            )}
                        </div>

                        {!selectedRole && suggestions.length > 0 && (
                            <div className="border-t border-blue-100 px-2.5 py-2 bg-white">
                                <p className="mb-1.5 text-[10px] font-semibold text-gray-500">Try asking:</p>
                                <div className="flex flex-wrap gap-1">
                                    {suggestions.slice(0, 3).map((item) => (
                                        <button
                                            type="button"
                                            key={item}
                                            onClick={() => sendMessage(item)}
                                            className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:border-blue-400 hover:text-blue-700"
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form
                            className="border-t border-blue-100 bg-white p-1.5"
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendMessage();
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about features, docs, skills, cities..."
                                    className="h-9 flex-1 rounded-xl border border-gray-300 px-2.5 text-[13px] sm:text-sm outline-none focus:border-blue-500"
                                />
                                <button
                                    type="submit"
                                    disabled={isSending || !input.trim()}
                                    className="h-9 w-9 rounded-xl bg-blue-600 text-white disabled:opacity-50 flex items-center justify-center"
                                    aria-label="Send"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
