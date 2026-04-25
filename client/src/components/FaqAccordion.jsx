import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FaqAccordion = ({ items, defaultOpenIndex = 0, className = '' }) => {
    const [openIndex, setOpenIndex] = useState(defaultOpenIndex);

    return (
        <div className={className}>
            {items.map((item, index) => {
                const isOpen = openIndex === index;

                return (
                    <motion.article
                        key={item.question}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.35, delay: index * 0.03 }}
                        className="group overflow-hidden rounded-3xl border border-orange-100 bg-white/90 shadow-lg shadow-orange-100/40 backdrop-blur-sm"
                    >
                        <button
                            type="button"
                            onClick={() => setOpenIndex(isOpen ? -1 : index)}
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                        >
                            <div className="flex items-start gap-3">
                                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-200">
                                    <HelpCircle size={18} />
                                </span>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-500">
                                        {item.category}
                                    </p>
                                    <h3 className="mt-1 text-base font-bold text-gray-900 sm:text-lg">
                                        {item.question}
                                    </h3>
                                </div>
                            </div>

                            <motion.span
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500"
                            >
                                <ChevronDown size={18} />
                            </motion.span>
                        </button>

                        <AnimatePresence initial={false}>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="px-5 pb-5 sm:px-6"
                                >
                                    <div className="rounded-2xl bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4 text-sm leading-7 text-gray-600 sm:p-5 sm:text-base">
                                        {item.answer}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.article>
                );
            })}
        </div>
    );
};

export default FaqAccordion;