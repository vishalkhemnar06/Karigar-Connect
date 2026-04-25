// src/components/ClientChatbotWidget.jsx
// PREMIUM VERSION - Modern chat interface with animations, voice support, and enhanced UX

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    Bot, Send, Mic, MicOff, Volume2, VolumeX, X, 
    Minimize2, Sparkles, Maximize2, MessageCircle, 
    HelpCircle, Zap, Star, Briefcase, ShieldAlert,
    Trash2, Phone, Mail, Calendar, Clock, User, CheckCircle, AlertCircle
} from 'lucide-react';
import {
    getClientChatbotSuggestions,
    queryClientChatbot,
    requestClientChatbotSupport,
    getClientChatbotSupportCurrent,
    sendClientChatbotSupportMessage,
    closeClientChatbotSupportRequest,
} from '../api';

const SUPPORTED_UI_LANGUAGES = new Set(['en', 'hi', 'mr']);

const getPreferredUiLanguage = () => {
    const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([a-z]{2})/i);
    const lang = (match?.[1] || 'en').toLowerCase();
    return SUPPORTED_UI_LANGUAGES.has(lang) ? lang : 'en';
};

const langToSpeechCode = (lang) => {
    if (lang === 'hi') return 'hi-IN';
    if (lang === 'mr') return 'mr-IN';
    return 'en-IN';
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const formatDuration = (seconds = 0) => {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
};

const getStarterText = (lang) => {
    if (lang === 'hi') {
        return 'नमस्ते! मैं आपके क्लाइंट पैनल, जॉब्स काउंट, और शहर में वर्कर उपलब्धता में मदद कर सकता हूँ।';
    }
    if (lang === 'mr') {
        return 'नमस्कार! मी तुमच्या क्लायंट पॅनल, जॉब्स काउंट, आणि तुमच्या शहरातील वर्कर उपलब्धता मध्ये मदत करू शकतो.';
    }
    return 'Hello! I can help with client panel navigation, your job counts, and worker availability in your city.';
};

const getBotAvatar = (confidence) => {
    if (confidence === 'high') return '🤖';
    if (confidence === 'medium') return '💬';
    return '🔄';
};

export default function ClientChatbotWidget() {
    const navigate = useNavigate();
    const location = useLocation();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [messages, setMessages] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [pendingFollowUp, setPendingFollowUp] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [speechEnabled, setSpeechEnabled] = useState(false);
    const [typing, setTyping] = useState(false);
    const [supportRequest, setSupportRequest] = useState(null);
    const [supportLoading, setSupportLoading] = useState(false);
    const [chatCleared, setChatCleared] = useState(false);
    const [supportNow, setSupportNow] = useState(Date.now());
    const supportLifecycleRef = useRef({ id: null, status: null });

    const language = useMemo(() => getPreferredUiLanguage(), []);
    const listRef = useRef(null);
    const recognitionRef = useRef(null);
    const inputRef = useRef(null);

    // Initialize chat
    useEffect(() => {
        setMessages([
            {
                id: makeId(),
                role: 'bot',
                text: getStarterText(language),
                confidence: 'high',
                sourceType: 'gui-knowledge',
                actions: [
                    { label: 'Dashboard', route: '/client/dashboard', icon: Briefcase },
                    { label: 'Post Job', route: '/client/post-job', icon: Briefcase },
                    { label: 'Find Workers', route: '/client/find-workers', icon: User },
                ],
            },
        ]);
    }, [language]);

    // Load suggestions
    useEffect(() => {
        if (!isOpen) return;
        let active = true;

        const loadSuggestions = async () => {
            try {
                const { data } = await getClientChatbotSuggestions(language);
                if (!active) return;
                setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 6) : []);
            } catch {
                if (active) setSuggestions([]);
            }
        };

        loadSuggestions();
        return () => { active = false; };
    }, [isOpen, language]);

    // Monitor support state
    useEffect(() => {
        if (!isOpen) return undefined;
        let active = true;

        const loadSupportState = async () => {
            try {
                const { data } = await getClientChatbotSupportCurrent();
                if (!active) return;
                const nextRequest = data?.request || null;
                const lastHandled = supportLifecycleRef.current;

                if (nextRequest?.id && nextRequest.status !== 'pending' && nextRequest.status !== 'accepted') {
                    if (lastHandled.id !== nextRequest.id || lastHandled.status !== nextRequest.status) {
                        if (nextRequest.status === 'expired') {
                            setMessages((prev) => [
                                ...prev,
                                {
                                    id: makeId(),
                                    role: 'bot',
                                    text: 'No admin connected within 3 minutes. Returning to AI assistant.',
                                    confidence: 'medium',
                                    sourceType: 'human-handoff',
                                    actions: [],
                                },
                            ]);
                        }
                        if (nextRequest.status === 'closed') {
                            setMessages((prev) => [
                                ...prev,
                                {
                                    id: makeId(),
                                    role: 'bot',
                                    text: 'Support chat closed by admin. Continue with AI assistant.',
                                    confidence: 'medium',
                                    sourceType: 'human-handoff',
                                    actions: [],
                                },
                            ]);
                        }
                        supportLifecycleRef.current = { id: nextRequest.id, status: nextRequest.status };
                    }
                    setSupportRequest(null);
                    return;
                }

                if (nextRequest?.id && nextRequest.status === 'accepted' &&
                    (lastHandled.id !== nextRequest.id || lastHandled.status !== nextRequest.status)) {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: makeId(),
                            role: 'bot',
                            text: `Connected to ${nextRequest.acceptedByAdmin?.adminName || 'support admin'}. You can now chat directly.`,
                            confidence: 'high',
                            sourceType: 'human-handoff',
                            actions: [],
                        },
                    ]);
                }

                supportLifecycleRef.current = { id: nextRequest?.id || null, status: nextRequest?.status || null };
                setSupportRequest(nextRequest);
            } catch {
                if (active) setSupportRequest(null);
            }
        };

        loadSupportState();
        const interval = setInterval(loadSupportState, 4000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [isOpen]);

    // Timer for pending/accepted
    useEffect(() => {
        if (!supportRequest || !['pending', 'accepted'].includes(supportRequest.status)) return undefined;
        const interval = setInterval(() => setSupportNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [supportRequest?.status, supportRequest?.id]);

    // Cleanup expired/closed
    useEffect(() => {
        if (!supportRequest) return;
        if (supportRequest.status === 'expired' || supportRequest.status === 'closed') {
            setSupportRequest(null);
        }
    }, [supportRequest?.status, supportRequest?.id]);

    // Reset chat cleared flag
    useEffect(() => {
        setChatCleared(false);
    }, [supportRequest?.id, supportRequest?.status]);

    // Auto-scroll
    useEffect(() => {
        if (!listRef.current) return;
        listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages, supportRequest, isOpen, typing]);

    // Cleanup speech/recognition
    useEffect(() => () => {
        if (recognitionRef.current) {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.stop();
        }
        window.speechSynthesis?.cancel();
    }, []);

    const speak = (text, lang) => {
        if (!speechEnabled || !text) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = langToSpeechCode(lang);
        utter.rate = 0.9;
        window.speechSynthesis?.cancel();
        window.speechSynthesis?.speak(utter);
    };

    const requestHumanSupport = async () => {
        if (supportLoading || isSending) return;

        const conversationSnapshot = messages.slice(-10).map((m) => ({
            role: m.role === 'user' ? 'user' : m.role === 'bot' ? 'bot' : 'system',
            text: m.text,
        }));
        const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
        const initialMessage = String(input || lastUserMessage?.text || 'Need human support.').trim();

        try {
            setSupportLoading(true);
            const { data } = await requestClientChatbotSupport({
                currentRoute: location.pathname,
                initialMessage,
                conversationSnapshot,
            });

            const nextRequest = data?.request || null;
            setSupportRequest(nextRequest);
            setPendingFollowUp(null);
            setInput('');
            
            if (nextRequest?.status === 'pending') {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: makeId(),
                        role: 'bot',
                        text: '🆘 Human support requested. Waiting for an admin to join...',
                        confidence: 'medium',
                        sourceType: 'human-handoff',
                        actions: [],
                    },
                ]);
            }
            if (nextRequest?.status === 'accepted') {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: makeId(),
                        role: 'bot',
                        text: `✅ Connected to ${nextRequest.acceptedByAdmin?.adminName || 'support admin'}.`,
                        confidence: 'high',
                        sourceType: 'human-handoff',
                        actions: [],
                    },
                ]);
            }
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                {
                    id: makeId(),
                    role: 'bot',
                    text: error?.response?.data?.message || 'Unable to request support. Please try again.',
                    confidence: 'low',
                    sourceType: 'error',
                    actions: [],
                },
            ]);
        } finally {
            setSupportLoading(false);
        }
    };

    const cancelSupportRequest = async () => {
        if (!supportRequest?.id || supportLoading) return;
        
        try {
            setSupportLoading(true);
            const { data } = await closeClientChatbotSupportRequest({ requestId: supportRequest.id });
            setSupportRequest(data?.request || null);
            setMessages((prev) => [
                ...prev,
                {
                    id: makeId(),
                    role: 'bot',
                    text: supportRequest.status === 'pending' 
                        ? 'Support request cancelled.' 
                        : 'Chat session closed.',
                    confidence: 'medium',
                    sourceType: 'human-handoff',
                    actions: [],
                },
            ]);
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                {
                    id: makeId(),
                    role: 'bot',
                    text: error?.response?.data?.message || 'Unable to cancel request.',
                    confidence: 'low',
                    sourceType: 'error',
                    actions: [],
                },
            ]);
        } finally {
            setSupportLoading(false);
        }
    };

    const sendMessage = async (rawText) => {
        const question = String(rawText || input).trim();
        if (!question || isSending) return;

        // Handle pending support
        if (supportRequest?.status === 'pending') {
            setMessages((prev) => [
                ...prev,
                {
                    id: makeId(),
                    role: 'bot',
                    text: '⏳ Waiting for admin to accept your request. Please be patient.',
                    confidence: 'medium',
                    sourceType: 'human-handoff',
                    actions: [],
                },
            ]);
            return;
        }

        // Handle active support chat
        if (supportRequest?.status === 'accepted') {
            const userMessage = { id: makeId(), role: 'user', text: question };
            setMessages((prev) => [...prev, userMessage]);
            setInput('');
            setIsSending(true);
            try {
                const { data } = await sendClientChatbotSupportMessage({
                    requestId: supportRequest.id,
                    message: question,
                });
                if (data?.request) {
                    setSupportRequest(data.request);
                }
            } catch (error) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: makeId(),
                        role: 'bot',
                        text: error?.response?.data?.message || 'Failed to send message.',
                        confidence: 'low',
                        sourceType: 'error',
                        actions: [],
                    },
                ]);
            } finally {
                setIsSending(false);
            }
            return;
        }

        // AI chat mode
        const userMessage = { id: makeId(), role: 'user', text: question };
        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setIsSending(true);
        setTyping(true);

        setTimeout(async () => {
            try {
                const conversation = nextMessages.slice(-14).map((m) => ({ role: m.role, text: m.text }));
                const { data } = await queryClientChatbot({
                    message: question,
                    currentRoute: location.pathname,
                    preferredLanguage: language,
                    conversation,
                    followUpState: pendingFollowUp,
                });

                const botText = String(data?.answer || '').trim() || 'I could not process that. Please try again.';
                const followUpQuestion = String(data?.followUpQuestion || botText).trim();
                const botMessage = {
                    id: makeId(),
                    role: 'bot',
                    text: botText,
                    confidence: data?.confidence || 'medium',
                    sourceType: data?.sourceType || 'gui-knowledge',
                    actions: Array.isArray(data?.actions) ? data.actions : [],
                    blocked: Boolean(data?.blocked),
                    followUpRequired: Boolean(data?.followUpRequired),
                };

                setMessages((prev) => [...prev, botMessage]);
                if (data?.followUpRequired) {
                    setPendingFollowUp({
                        field: data.followUpField || null,
                        question: followUpQuestion,
                        skill: data.followUpSkill || null,
                        intent: data.followUpIntent || pendingFollowUp?.intent || null,
                        context: data.followUpContext || null,
                    });
                } else {
                    setPendingFollowUp(null);
                }
                speak(botText, data?.language || language);
            } catch (error) {
                setMessages((prev) => [
                    ...prev,
                    { id: makeId(), role: 'bot', text: 'Chatbot unavailable. Please try again.', confidence: 'low', sourceType: 'error', actions: [] },
                ]);
                setPendingFollowUp(null);
            } finally {
                setIsSending(false);
                setTyping(false);
            }
        }, 500);
    };

    const clearChat = () => {
        setMessages([
            {
                id: makeId(),
                role: 'bot',
                text: getStarterText(language),
                confidence: 'high',
                sourceType: 'gui-knowledge',
                actions: [
                    { label: 'Dashboard', route: '/client/dashboard', icon: Briefcase },
                    { label: 'Post Job', route: '/client/post-job', icon: Briefcase },
                    { label: 'Find Workers', route: '/client/find-workers', icon: User },
                ],
            },
        ]);
        setChatCleared(true);
        setInput('');
        setPendingFollowUp(null);
        if (inputRef.current) inputRef.current.focus();
    };

    const startVoiceInput = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input not supported in this browser');
            return;
        }

        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = langToSpeechCode(language);
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const text = event?.results?.[0]?.[0]?.transcript || '';
            setInput(String(text).trim());
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        setIsListening(true);
        recognition.start();
    };

    const onSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };

    const connectedTimer = supportRequest?.status === 'accepted'
        ? formatDuration(Math.floor((supportNow - new Date(supportRequest.connectionStartedAt || supportRequest.acceptedAt || supportRequest.requestedAt).getTime()) / 1000))
        : '0:00';
    const waitTimer = supportRequest?.status === 'pending'
        ? formatDuration(Math.max(0, Math.ceil((new Date(supportRequest.expiresAt).getTime() - supportNow) / 1000)))
        : '0:00';
    
    const supportMessages = supportRequest?.messages?.length
        ? supportRequest.messages.map((message, index) => ({
            id: `${message.createdAt || index}-${index}`,
            role: message.senderType === 'admin' ? 'admin' : message.senderType === 'client' ? 'user' : 'bot',
            text: message.message,
            senderName: message.senderName,
            createdAt: message.createdAt,
        }))
        : null;
    
    const displayedMessages = supportMessages
        ? (chatCleared ? supportMessages : [...supportMessages, ...messages])
        : messages;
    const isSupportPending = supportRequest?.status === 'pending';
    const isSupportConnected = supportRequest?.status === 'accepted';
    const supportState = supportRequest?.status || 'none';
    const totalMessageCount = (supportMessages?.length || 0) + messages.filter(m => m.role === 'user').length;

    const getSupportButton = () => {
        if (supportState === 'accepted') {
            return {
                label: 'End Chat',
                action: cancelSupportRequest,
                icon: X,
                variant: 'secondary',
            };
        }
        if (supportState === 'pending') {
            return {
                label: 'Cancel Request',
                action: cancelSupportRequest,
                icon: X,
                variant: 'danger',
            };
        }
        return {
            label: 'Live Support',
            action: requestHumanSupport,
            icon: ShieldAlert,
            variant: 'primary',
        };
    };

    const supportButton = getSupportButton();
    const SupportIcon = supportButton.icon;

    const getConfidenceBadge = (confidence) => {
        if (confidence === 'high') return { label: 'Verified', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' };
        if (confidence === 'medium') return { label: 'AI Suggestion', icon: Zap, color: 'text-amber-600 bg-amber-50' };
        return { label: 'Unverified', icon: AlertCircle, color: 'text-gray-500 bg-gray-100' };
    };

    return (
        <>
            {/* Floating Button */}
            <div className="fixed z-[70] right-4 md:right-6 bottom-6">
                <AnimatePresence>
                    {!isOpen && (
                        <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            whileTap={{ scale: 0.95 }}
                            whileHover={{ scale: 1.05 }}
                            onClick={() => {
                                setIsOpen(true);
                                setIsMinimized(false);
                            }}
                            className="group relative h-14 w-14 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                            <Bot size="24" className="relative z-10 mx-auto" />
                            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-white text-orange-600 text-[9px] font-bold flex items-center justify-center shadow-sm">
                                AI
                            </span>
                            {totalMessageCount > 0 && (
                                <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {totalMessageCount > 9 ? '9+' : totalMessageCount}
                                </span>
                            )}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Chat Widget */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed z-[80] right-4 md:right-6 bottom-6 w-[calc(100vw-2rem)] max-w-[480px]"
                    >
                        <div className="rounded-2xl bg-white shadow-2xl overflow-hidden border border-orange-100 flex flex-col">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                                            <Sparkles size="16" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">KarigarConnect Assistant</p>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                <p className="text-[9px] text-white/85">
                                                    {isSupportConnected ? 'Live with Admin' : 'AI Ready'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        <button
                                            onClick={() => setSpeechEnabled(!speechEnabled)}
                                            className="p-1.5 rounded-lg hover:bg-white/15 transition"
                                            title={speechEnabled ? 'Disable speech' : 'Enable speech'}
                                        >
                                            {speechEnabled ? <Volume2 size="14" /> : <VolumeX size="14" />}
                                        </button>
                                        <button
                                            onClick={() => setIsMinimized(!isMinimized)}
                                            className="p-1.5 rounded-lg hover:bg-white/15 transition"
                                            title={isMinimized ? 'Expand' : 'Minimize'}
                                        >
                                            {isMinimized ? <Maximize2 size="14" /> : <Minimize2 size="14" />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsOpen(false);
                                                setIsMinimized(false);
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-white/15 transition"
                                            title="Close"
                                        >
                                            <X size="14" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {!isMinimized && (
                                <>
                                    {/* Support Status Bar */}
                                    <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {supportState === 'accepted' ? (
                                                <CheckCircle size="14" className="text-emerald-600" />
                                            ) : supportState === 'pending' ? (
                                                <Clock size="14" className="text-amber-600" />
                                            ) : (
                                                <Bot size="14" className="text-orange-600" />
                                            )}
                                            <span className="text-xs text-gray-700">
                                                {supportState === 'accepted' && `Live with Admin • ${connectedTimer}`}
                                                {supportState === 'pending' && `Requesting Admin • ${waitTimer} left`}
                                                {supportState === 'none' && 'AI Assistant • Instant replies'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={supportButton.action}
                                            disabled={supportLoading}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                                supportButton.variant === 'primary' 
                                                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                                                    : supportButton.variant === 'danger'
                                                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            } disabled:opacity-50`}
                                        >
                                            <SupportIcon size="12" />
                                            {supportButton.label}
                                        </button>
                                    </div>

                                    {/* Messages Area */}
                                    <div ref={listRef} className="h-[380px] overflow-y-auto bg-gray-50 p-4 space-y-3 custom-scrollbar">
                                        <AnimatePresence initial={false}>
                                            {displayedMessages.map((msg, idx) => {
                                                const isUser = msg.role === 'user';
                                                const isAdmin = msg.role === 'admin';
                                                const isBot = msg.role === 'bot';
                                                const confidenceBadge = isBot && msg.confidence ? getConfidenceBadge(msg.confidence) : null;
                                                
                                                return (
                                                    <motion.div
                                                        key={msg.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.03 }}
                                                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
                                                            {!isUser && (
                                                                <div className="flex items-center gap-1.5 mb-1 ml-1">
                                                                    <span className="text-xs">
                                                                        {isAdmin ? '👨‍💼' : isBot ? getBotAvatar(msg.confidence) : '📢'}
                                                                    </span>
                                                                    <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">
                                                                        {isAdmin ? (msg.senderName || 'Admin') : isBot ? 'Assistant' : 'System'}
                                                                    </span>
                                                                    {confidenceBadge && (
                                                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium ${confidenceBadge.color}`}>
                                                                            <confidenceBadge.icon size="8" />
                                                                            {confidenceBadge.label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div className={`rounded-2xl px-3 py-2 shadow-sm ${
                                                                isUser 
                                                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-sm' 
                                                                    : isAdmin
                                                                        ? 'bg-emerald-50 border border-emerald-200 text-gray-800 rounded-bl-sm'
                                                                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                                                            }`}>
                                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                                {isBot && msg.actions && msg.actions.length > 0 && (
                                                                    <div className="mt-2 pt-1.5 flex flex-wrap gap-1.5">
                                                                        {msg.actions.map((action, idx) => {
                                                                            const ActionIcon = action.icon || Briefcase;
                                                                            return (
                                                                                <button
                                                                                    key={idx}
                                                                                    onClick={() => action?.route && navigate(action.route)}
                                                                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 transition"
                                                                                >
                                                                                    <ActionIcon size="10" />
                                                                                    {action?.label || 'Open'}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                            {typing && (
                                                <div className="flex justify-start">
                                                    <div className="bg-white border border-gray-200 rounded-2xl px-3 py-2">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Quick Suggestions */}
                                    {suggestions.length > 0 && !isSupportConnected && (
                                        <div className="px-4 py-2 border-t border-gray-100 bg-white">
                                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                <Zap size="10" /> Quick Questions
                                            </p>
                                            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                                                {suggestions.map((s, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => sendMessage(s)}
                                                        className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-700 transition whitespace-nowrap"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Follow-up Question */}
                                    {pendingFollowUp?.question && !isSupportConnected && (
                                        <div className="px-4 py-2 border-t border-orange-100 bg-orange-50">
                                            <p className="text-[9px] font-bold text-orange-600 uppercase tracking-wider mb-1">Follow-up needed</p>
                                            <div className="text-xs text-gray-700 bg-white rounded-lg px-3 py-2 shadow-sm border border-orange-200">
                                                {pendingFollowUp.question}
                                            </div>
                                        </div>
                                    )}

                                    {/* Input Area */}
                                    <form onSubmit={onSubmit} className="p-3 border-t border-gray-100 bg-white">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={startVoiceInput}
                                                className={`h-9 w-9 rounded-lg border flex items-center justify-center transition ${
                                                    isListening 
                                                        ? 'border-red-300 bg-red-50 text-red-600' 
                                                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                                title="Voice input"
                                            >
                                                {isListening ? <MicOff size="14" /> : <Mic size="14" />}
                                            </button>
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                placeholder={
                                                    isSupportConnected 
                                                        ? 'Type your message...' 
                                                        : isSupportPending 
                                                            ? 'Waiting for admin...' 
                                                            : 'Ask me anything...'
                                                }
                                                disabled={isSupportPending || isSending}
                                                className="flex-1 h-9 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 disabled:bg-gray-50"
                                            />
                                            <button
                                                type="submit"
                                                disabled={isSending || !input.trim() || isSupportPending}
                                                className="h-9 w-9 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-center disabled:opacity-50 hover:shadow-md transition"
                                            >
                                                {isSending ? (
                                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Send size="14" />
                                                )}
                                            </button>
                                            {!isSupportConnected && !isSupportPending && (
                                                <button
                                                    type="button"
                                                    onClick={clearChat}
                                                    className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition"
                                                    title="Clear chat"
                                                >
                                                    <Trash2 size="14" />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[8px] text-gray-400 text-center mt-2">
                                            {isSupportConnected 
                                                ? 'Connected to support admin. Your messages are being monitored.'
                                                : 'AI responses are suggestions. Verify critical information.'}
                                        </p>
                                    </form>
                                </>
                            )}

                            {/* Minimized View */}
                            {isMinimized && (
                                <div className="p-3 text-center bg-gray-50">
                                    <p className="text-xs text-gray-500">Chat minimized • Tap to expand</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #f97316;
                    border-radius: 10px;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </>
    );
}