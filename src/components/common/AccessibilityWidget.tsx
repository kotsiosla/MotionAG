import { useState } from "react";
import { Accessibility, Check, Settings2, ZoomIn, Contrast, Type } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AccessibilityWidgetProps {
    onToggle: (enabled: boolean) => void;
    isEnabled: boolean;
}

export function AccessibilityWidget({ onToggle, isEnabled }: AccessibilityWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-20 right-4 z-[100] sm:bottom-6">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={cn(
                            "relative group transition-all duration-300 transform hover:scale-110 active:scale-95",
                            "focus:outline-none focus:ring-4 focus:ring-blue-400 rounded-full"
                        )}
                        aria-label="Μενού Προσβασιμότητας"
                    >
                        {/* The Outer Blue Circle */}
                        <div className="bg-blue-600 rounded-full p-2.5 sm:p-3 shadow-2xl border-2 border-white shadow-blue-500/50">
                            <Accessibility className="text-white h-7 w-7 sm:h-8 sm:w-8" />
                        </div>

                        {/* The Badge Checkmark */}
                        <div className={cn(
                            "absolute -top-1 -right-1 bg-white rounded-full p-0.5 border-2 border-blue-600 transition-opacity duration-300",
                            isEnabled ? "opacity-100 scale-100" : "opacity-0 scale-50"
                        )}>
                            <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-600 font-bold" strokeWidth={4} />
                        </div>
                    </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 glass-card p-4 border-2 border-blue-600/20 shadow-2xl animate-in slide-in-from-bottom-2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2 mb-2">
                            <Settings2 className="h-4 w-4 text-blue-600" />
                            <h4 className="font-bold text-sm">Ρυθμίσεις Προσβασιμότητας</h4>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                                        <Accessibility className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <Label htmlFor="enhanced-mode" className="text-xs font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Ενισχυμένη Πρόσβαση
                                        </Label>
                                        <p className="text-[10px] text-muted-foreground mt-1">WCAG 2.2 Standard (2025)</p>
                                    </div>
                                </div>
                                <Switch
                                    id="enhanced-mode"
                                    checked={isEnabled}
                                    onCheckedChange={onToggle}
                                />
                            </div>

                            <div className="pt-2 border-t border-border/50 text-[10px] space-y-2 text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <ZoomIn className="h-3 w-3" />
                                    <span>Μεγαλύτερα στοιχεία αφής (Touch Targets)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Type className="h-3 w-3" />
                                    <span>Αυξημένο μέγεθος γραμματοσειράς</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Contrast className="h-3 w-3" />
                                    <span>Ενισχυμένη αντίθεση & περιγράμματα</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-[9px] text-center text-muted-foreground italic border-t pt-2">
                            Συμμορφωμένο με τις οδηγίες AllAccessible 2025
                        </p>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
