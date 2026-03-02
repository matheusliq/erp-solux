"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export interface CalendarDot {
    date: string;
    color: string;
}

interface CalendarPickerProps {
    value?: string;
    onChange?: (date: string) => void;
    dots?: CalendarDot[];
    minDate?: string;
    maxDate?: string;
    className?: string;
}

function pad(n: number) {
    return String(n).padStart(2, "0");
}

function toStr(y: number, m: number, d: number) {
    return y + "-" + pad(m + 1) + "-" + pad(d);
}

export default function CalendarPicker({
    value,
    onChange,
    dots = [],
    minDate,
    maxDate,
    className = "",
}: CalendarPickerProps) {
    const today = new Date();
    const initialDate = value ? new Date(value + "T12:00:00") : today;
    const [viewYear, setViewYear] = useState(initialDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

    const dotMap = useMemo(() => {
        const map: Record<string, string[]> = {};
        dots.forEach(({ date, color }) => {
            if (!map[date]) map[date] = [];
            map[date].push(color);
        });
        return map;
    }, [dots]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;

    const cells: (number | null)[] = [
        ...Array(startOffset).fill(null),
        ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const isSelected = (d: number) => value === toStr(viewYear, viewMonth, d);
    const isTodayFn = (d: number) =>
        today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === d;
    const isDisabled = (d: number) => {
        const s = toStr(viewYear, viewMonth, d);
        if (minDate && s < minDate) return true;
        if (maxDate && s > maxDate) return true;
        return false;
    };

    const handleClick = (d: number) => {
        if (isDisabled(d)) return;
        onChange?.(toStr(viewYear, viewMonth, d));
    };

    return (
        <div className={"w-full select-none " + className}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
                <button
                    onClick={prevMonth}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 border border-zinc-800 hover:border-emerald-500/30 transition-all"
                >
                    <ChevronLeft size={14} />
                </button>
                <div className="text-sm font-bold text-white tracking-wide">
                    {MONTHS[viewMonth]}{" "}
                    <span className="text-zinc-500 font-medium">{viewYear}</span>
                </div>
                <button
                    onClick={nextMonth}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10 border border-zinc-800 hover:border-emerald-500/30 transition-all"
                >
                    <ChevronRight size={14} />
                </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(d => (
                    <div key={d} className="text-center text-[9px] font-bold uppercase tracking-widest text-zinc-600 py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const dateStr = toStr(viewYear, viewMonth, day);
                    const dayDots = dotMap[dateStr] || [];
                    const selected = isSelected(day);
                    const isCurrentDay = isTodayFn(day);
                    const disabled = isDisabled(day);

                    const cls = [
                        "relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-xs font-semibold transition-all duration-100",
                        disabled ? "text-zinc-700 cursor-not-allowed" : "cursor-pointer",
                        selected
                            ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                            : isCurrentDay
                                ? "text-blue-400 border border-blue-500/30 hover:bg-blue-500/10"
                                : disabled
                                    ? ""
                                    : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white",
                    ].join(" ");

                    return (
                        <button
                            key={i}
                            onClick={() => handleClick(day)}
                            disabled={disabled}
                            className={cls}
                            title={dateStr}
                        >
                            {day}
                            {dayDots.length > 0 && !selected && (
                                <div className="flex gap-0.5 mt-0.5">
                                    {dayDots.slice(0, 3).map((color, di) => (
                                        <span key={di} className={"w-1 h-1 rounded-full " + color} />
                                    ))}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
