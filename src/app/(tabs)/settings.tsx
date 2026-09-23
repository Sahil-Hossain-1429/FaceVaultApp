import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Design tokens (mirrors global.css) ─────────────────────────────────────
const C = {
    bgMain: '#0E172A',
    bgSidebar: '#1B293C',
    bgDark: '#010617',
    surfaceDefault: '#1B293C',
    surfaceRaised: '#22334A',
    surfaceSelected: '#192E61',
    surfaceSelectedLight: '#122453',
    borderDefault: '#2F4157',
    borderStrong: '#43556B',
    primary: '#5FAEF7',
    primaryHover: '#57ABFB',
    textPrimary: '#F3F6F9',
    textWhite: '#FFFFFF',
    textSecondary: '#D4DDE7',
    textMuted: '#8698B4',
    textDisabled: '#60748D',
    success: '#006633',
    successBg: '#002E16',
    successGreen: '#38C97A',
    danger: '#CF1914',
    dangerSurface: 'rgba(207,25,20,0.10)',
} as const;

// ─── Shared sub-components ───────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
    return <Text style={styles.sectionLabel}>{label}</Text>;
}

interface RowProps {
    icon: React.ReactNode;
    iconBg?: string;
    iconColor?: string;
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    onPress?: () => void;
    danger?: boolean;
    last?: boolean;
}

function Row({
    icon,
    iconBg = C.surfaceSelectedLight,
    iconColor = C.primary,
    title,
    subtitle,
    right,
    onPress,
    danger = false,
    last = false,
}: RowProps) {
    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={({ pressed }) => [
                styles.row,
                !last && styles.rowBorder,
                pressed && onPress && styles.rowPressed,
            ]}
            accessibilityRole="button"
        >
            {/* Icon */}
            <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
                <View style={{ color: iconColor } as any}>{icon}</View>
            </View>

            {/* Label block */}
            <View style={styles.rowText}>
                <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
                {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
            </View>

            {/* Right slot */}
            {right !== undefined ? (
                <View style={styles.rowRight}>{right}</View>
            ) : onPress ? (
                <Text style={styles.chevron}>›</Text>
            ) : null}
        </Pressable>
    );
}

// ─── Auto-Lock modal ─────────────────────────────────────────────────────────

const AUTO_LOCK_OPTIONS = [
    { label: 'Immediately', value: 0 },
    { label: '1 minute', value: 1 },
    { label: '5 minutes', value: 5 },
    { label: '15 minutes', value: 15 },
] as const;

type AutoLockValue = (typeof AUTO_LOCK_OPTIONS)[number]['value'];

function AutoLockModal({
    visible,
    current,
    onSelect,
    onClose,
}: {
    visible: boolean;
    current: AutoLockValue;
    onSelect: (v: AutoLockValue) => void;
    onClose: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={() => { }}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>Auto-Lock</Text>
                    <Text style={styles.sheetDesc}>
                        Lock the vault after this period of inactivity.
                    </Text>

                    <View style={styles.card}>
                        {AUTO_LOCK_OPTIONS.map((opt, i) => {
                            const selected = opt.value === current;
                            const last = i === AUTO_LOCK_OPTIONS.length - 1;
                            return (
                                <Pressable
                                    key={opt.value}
                                    onPress={() => { onSelect(opt.value); onClose(); }}
                                    style={({ pressed }) => [
                                        styles.optionRow,
                                        !last && styles.rowBorder,
                                        pressed && styles.rowPressed,
                                    ]}
                                >
                                    <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
                                        {opt.label}
                                    </Text>
                                    {selected ? (
                                        <Text style={[styles.chevron, { color: C.primary, fontSize: 20 }]}>✓</Text>
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ─── Log Out confirmation dialog ─────────────────────────────────────────────

function LogOutDialog({
    visible,
    onConfirm,
    onCancel,
}: {
    visible: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.dialogOverlay}>
                <View style={styles.dialog}>
                    {/* Icon */}
                    <View style={styles.dialogIconWrap}>
                        {/* Exit icon — simple SVG-less text substitute */}
                        <Text style={styles.dialogIconText}>→</Text>
                    </View>

                    <Text style={styles.dialogTitle}>Log out of FaceVault?</Text>
                    <Text style={styles.dialogBody}>
                        You'll need to sign in again and pass the face scan to access your vault.
                    </Text>

                    <View style={styles.dialogActions}>
                        <TouchableOpacity style={[styles.dialogBtn, styles.dialogBtnCancel]} onPress={onCancel}>
                            <Text style={styles.dialogBtnCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.dialogBtn, styles.dialogBtnDanger]} onPress={onConfirm}>
                            <Text style={styles.dialogBtnDangerText}>Log Out</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ─── Coming Soon modal ─────────────────────────────────────────────────────────

function ComingSoonDialog({
    visible,
    onClose,
}: {
    visible: boolean;
    onClose: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.dialogOverlay}>
                <View style={styles.dialog}>
                    <View style={styles.dialogIconWrap}>
                        <Text style={styles.dialogIconText}>✨</Text>
                    </View>

                    <Text style={styles.dialogTitle}>Stay Tuned</Text>
                    <Text style={styles.dialogBody}>
                        Stay Tuned for the upcoming updates
                    </Text>

                    <TouchableOpacity
                        style={[styles.dialogBtn, styles.dialogBtnCancel]}
                        onPress={onClose}
                    >
                        <Text style={styles.dialogBtnCancelText}>Okay</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── Appearance segmented control ────────────────────────────────────────────

const APPEARANCE_OPTIONS = ['Light', 'Dark', 'System'] as const;
type AppearanceOption = (typeof APPEARANCE_OPTIONS)[number];

function AppearanceControl({
    value,
    onChange,
}: {
    value: AppearanceOption;
    onChange: (v: AppearanceOption) => void;
}) {
    return (
        <View style={styles.segmented}>
            {APPEARANCE_OPTIONS.map((opt) => (
                <Pressable
                    key={opt}
                    onPress={() => onChange(opt)}
                    style={[styles.segment, opt === value && styles.segmentActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: opt === value }}
                >
                    <Text style={[styles.segmentText, opt === value && styles.segmentTextActive]}>
                        {opt}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

// ─── Main Settings screen ────────────────────────────────────────────────────

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();

    // Local state
    const [faceIdEnabled, setFaceIdEnabled] = useState(true);
    const [autoLock, setAutoLock] = useState<AutoLockValue>(0);
    const [appearance, setAppearance] = useState<AppearanceOption>('Dark');
    const [showAutoLock, setShowAutoLock] = useState(false);
    const [showLogOut, setShowLogOut] = useState(false);
    const [showComingSoon, setShowComingSoon] = useState(false);

    const autoLockLabel =
        autoLock === 0 ? 'Immediately' : `${autoLock} minute${autoLock === 1 ? '' : 's'}`;

    const handleReEnroll = useCallback(() => {
        router.push('/face-enrollment-dev');
    }, []);

    const handleAddFace = useCallback(() => {
        setShowComingSoon(true);
    }, []);

    const handleChangePin = useCallback(() => {
        setShowComingSoon(true);
    }, []);

    const handleChangePattern = useCallback(() => {
        setShowComingSoon(true);
    }, []);

    const handleAccountInfo = useCallback(() => {
        setShowComingSoon(true);
    }, []);

    const handleLogOut = useCallback(() => {
        // Perform Clerk sign-out here
        // await signOut();
        router.replace('/(auth)/login');
        setShowLogOut(false);
    }, []);

    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Profile card ── */}
                <Pressable
                    onPress={handleAccountInfo}
                    style={({ pressed }) => [styles.profileCard, pressed && styles.rowPressed]}
                >
                    <View style={styles.avatar}>
                    </View>
                    <View style={styles.profileText}>
                        <Text style={styles.profileName}>Welcome User</Text>
                        <Text style={styles.profileEmail}>Your vault is safe now</Text>
                    </View>
                </Pressable>

                {/* ── Security ── */}
                <SectionLabel label="Security" />
                <View style={styles.card}>
                    <Row
                        icon={<FaceIcon color={C.primary} />}
                        title="Facial Recognition"
                        subtitle={faceIdEnabled ? 'Configured · 1 face' : 'Disabled'}
                        right={
                            <Switch
                                value={faceIdEnabled}
                                onValueChange={setFaceIdEnabled}
                                trackColor={{ false: C.borderStrong, true: C.primary }}
                                thumbColor={C.textWhite}
                                ios_backgroundColor={C.borderStrong}
                            />
                        }
                    />
                    <Row
                        icon={<AddFaceIcon color={C.primary} />}
                        title="Add Another Face"
                        onPress={handleAddFace}
                    />
                    <Row
                        icon={<ReEnrollIcon color={C.primary} />}
                        title="Re-enroll Face"
                        subtitle="Front angle only"
                        onPress={handleReEnroll}
                    />
                    <Row
                        icon={<PinIcon color={C.primary} />}
                        title="Change PIN"
                        onPress={handleChangePin}
                    />
                    <Row
                        icon={<PatternIcon color={C.primary} />}
                        title="Change Pattern"
                        onPress={handleChangePattern}
                    />
                    <Row
                        icon={<ClockIcon color={C.primary} />}
                        title="Auto-Lock"
                        subtitle={autoLockLabel}
                        onPress={() => setShowAutoLock(true)}
                        last
                    />
                </View>

                {/* ── Appearance ── */}
                <SectionLabel label="Appearance" />
                <View style={[styles.card, { padding: 14 }]}>
                    <AppearanceControl value={appearance} onChange={setAppearance} />
                </View>

                {/* ── Account ── */}
                <SectionLabel label="Account" />
                <View style={styles.card}>
                    <Row
                        icon={<AccountIcon color={C.primary} />}
                        title="Account Information"
                        onPress={handleAccountInfo}
                    />
                    <Row
                        icon={<LogOutIcon color={C.danger} />}
                        iconBg={C.dangerSurface}
                        title="Log Out"
                        danger
                        onPress={() => setShowLogOut(true)}
                        last
                    />
                </View>
            </ScrollView>

            {/* ── Modals ── */}
            <AutoLockModal
                visible={showAutoLock}
                current={autoLock}
                onSelect={setAutoLock}
                onClose={() => setShowAutoLock(false)}
            />
            <LogOutDialog
                visible={showLogOut}
                onConfirm={handleLogOut}
                onCancel={() => setShowLogOut(false)}
            />
            <ComingSoonDialog
                visible={showComingSoon}
                onClose={() => setShowComingSoon(false)}
            />
        </View>
    );
}

// ─── Inline icon components (no external deps) ───────────────────────────────

function FaceIcon({ color }: { color: string }) {
    return (
        <View style={[iconStyles.base, { borderColor: color }]}>
            <View style={[iconStyles.faceOval, { borderColor: color }]} />
        </View>
    );
}

function AddFaceIcon({ color }: { color: string }) {
    return (
        <View style={iconStyles.base}>
            <View style={[iconStyles.faceOval, { borderColor: color }]} />
            <View style={[iconStyles.addPlus, { backgroundColor: color }]}>
                <Text style={iconStyles.plusText}>+</Text>
            </View>
        </View>
    );
}

function ReEnrollIcon({ color }: { color: string }) {
    return (
        <View style={iconStyles.base}>
            <Text style={[iconStyles.text, { color }]}>↺</Text>
        </View>
    );
}

function PinIcon({ color }: { color: string }) {
    return (
        <View style={iconStyles.base}>
            <View style={[iconStyles.lock, { borderColor: color }]}>
                <View style={[iconStyles.lockBody, { borderColor: color }]} />
            </View>
        </View>
    );
}

function PatternIcon({ color }: { color: string }) {
    const dot = [iconStyles.dot, { backgroundColor: color }] as const;
    return (
        <View style={iconStyles.base}>
            <View style={iconStyles.grid3x3}>
                {Array.from({ length: 9 }).map((_, i) => (
                    <View key={i} style={dot} />
                ))}
            </View>
        </View>
    );
}

function ClockIcon({ color }: { color: string }) {
    return (
        <View style={iconStyles.base}>
            <Text style={[iconStyles.text, { color }]}>◷</Text>
        </View>
    );
}

function AccountIcon({ color }: { color: string }) {
    return (
        <View style={iconStyles.base}>
            <Text style={[iconStyles.text, { color }]}>👤</Text>
        </View>
    );
}

function LogOutIcon({ color }: { color: string }) {
    return (
        <View style={iconStyles.base}>
            <Text style={[iconStyles.text, { color, fontSize: 15 }]}>→</Text>
        </View>
    );
}

const iconStyles = StyleSheet.create({
    base: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    text: {
        fontSize: 17,
        lineHeight: 20,
    },
    faceOval: {
        width: 16,
        height: 20,
        borderRadius: 8,
        borderWidth: 1.5,
    },
    addPlus: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plusText: {
        fontSize: 10,
        color: '#04101f',
        fontWeight: '700',
        lineHeight: 12,
    },
    lock: {
        width: 14,
        height: 10,
        borderRadius: 2,
        borderWidth: 1.5,
        marginTop: 4,
    },
    lockBody: {
        position: 'absolute',
        top: -8,
        left: 2,
        width: 6,
        height: 8,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        borderWidth: 1.5,
        borderBottomWidth: 0,
    },
    grid3x3: {
        width: 20,
        height: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.bgMain,
    },

    // Header
    header: {
        paddingHorizontal: 20,
        paddingBottom: 14,
        paddingTop: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: C.textWhite,
        letterSpacing: -0.3,
    },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 20,
    },

    // Section label
    sectionLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        letterSpacing: 0.06 * 11.5,
        textTransform: 'uppercase',
        color: C.textMuted,
        marginTop: 24,
        marginBottom: 8,
        marginHorizontal: 4,
    },

    // Card wrapper
    card: {
        backgroundColor: C.surfaceDefault,
        borderWidth: 1,
        borderColor: C.borderDefault,
        borderRadius: 14,
        overflow: 'hidden',
    },

    // Row
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 13,
        paddingHorizontal: 12,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.borderDefault,
    },
    rowPressed: {
        backgroundColor: C.surfaceRaised,
    },
    rowIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    rowText: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 14.5,
        fontWeight: '600',
        color: C.textPrimary,
    },
    rowTitleDanger: {
        color: C.danger,
    },
    rowSub: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 1,
    },
    rowRight: {
        flexShrink: 0,
    },
    chevron: {
        fontSize: 22,
        color: C.textDisabled,
        lineHeight: 26,
        flexShrink: 0,
    },

    // Profile card
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: C.surfaceDefault,
        borderWidth: 1,
        borderColor: C.borderDefault,
        borderRadius: 14,
        padding: 14,
        marginTop: 8,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: C.surfaceSelected,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: C.primary,
    },
    profileText: {
        flex: 1,
    },
    profileName: {
        fontSize: 15,
        fontWeight: '700',
        color: C.textWhite,
    },
    profileEmail: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 1,
    },

    // Segmented control
    segmented: {
        flexDirection: 'row',
        backgroundColor: C.surfaceDefault,
        borderRadius: 10,
        padding: 3,
        gap: 3,
    },
    segment: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: 8,
        alignItems: 'center',
    },
    segmentActive: {
        backgroundColor: C.surfaceSelected,
    },
    segmentText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: C.textMuted,
    },
    segmentTextActive: {
        color: C.textWhite,
    },

    // Auto-lock bottom sheet
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(1,6,23,0.65)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: C.bgSidebar,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: 1,
        borderColor: C.borderDefault,
        paddingHorizontal: 20,
        paddingBottom: 36,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 99,
        backgroundColor: C.borderStrong,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    sheetTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: C.textWhite,
        marginBottom: 4,
    },
    sheetDesc: {
        fontSize: 13,
        color: C.textMuted,
        marginBottom: 18,
        lineHeight: 18,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 4,
    },
    optionLabel: {
        fontSize: 14.5,
        fontWeight: '500',
        color: C.textPrimary,
    },
    optionLabelActive: {
        color: C.primary,
        fontWeight: '600',
    },
    cancelBtn: {
        marginTop: 14,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: C.surfaceDefault,
        borderWidth: 1,
        borderColor: C.borderDefault,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: C.textPrimary,
    },

    // Log out dialog
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(1,6,23,0.72)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    dialog: {
        width: '100%',
        backgroundColor: C.surfaceRaised,
        borderWidth: 1,
        borderColor: C.borderDefault,
        borderRadius: 18,
        padding: 24,
        alignItems: 'center',
    },
    dialogIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    dialogIconText: {
        fontSize: 22,
        color: C.danger,
    },
    dialogTitle: {
        fontSize: 16.5,
        fontWeight: '700',
        color: C.textWhite,
        textAlign: 'center',
        marginBottom: 8,
    },
    dialogBody: {
        fontSize: 13.5,
        color: C.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 22,
    },
    dialogActions: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    dialogBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    dialogBtnCancel: {
        width: '100%',
        minHeight: 48,
        paddingVertical: 13,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogBtnCancelText: {
        fontSize: 15,
        fontWeight: '700',
        color: C.bgDark,
    },
    dialogBtnDanger: {
        backgroundColor: C.danger,
    },
    dialogBtnDangerText: {
        fontSize: 13.5,
        fontWeight: '600',
        color: C.textWhite,
    },
});