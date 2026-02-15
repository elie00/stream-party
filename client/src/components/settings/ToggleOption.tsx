/**
 * Reusable toggle switch component for settings
 */
export function ToggleOption({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between py-2">
            <div>
                <div className="text-white">{label}</div>
                <div className="text-sm text-gray-400">{description}</div>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
            >
                <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'left-7' : 'left-1'
                        }`}
                />
            </button>
        </div>
    );
}
