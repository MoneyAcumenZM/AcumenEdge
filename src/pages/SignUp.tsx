import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, Upload, Check, Eye, EyeOff, User, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { middlewareClient } from '@/services/middlewareClient';

import { sanitizeFilename } from '@/lib/sanitize';
import { sanitizeError } from '@/lib/errors';
import { logAudit } from '@/lib/audit';
import { SECURITY_CONFIG, getPasswordStrength, isPasswordStrong } from '@/lib/security';
import circleLogo from '@/assets/circle-logo-new.svg';

const RELATIONS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Other'];
const PROVINCES = ['Lusaka', 'Copperbelt', 'Southern', 'Eastern', 'Western', 'Northern', 'Luapula', 'North-Western', 'Muchinga', 'Central'];

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  date_of_birth: string;
  nrc_passport: string;
  tpin: string;
  physical_address: string;
  province: string;
  bank_name: string;
  bank_account_number: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  next_of_kin_relation: string;
  doc_id: File | null;
  doc_proof: File | null;
  doc_selfie: File | null;
  confirmInfo: boolean;
  agreeTerms: boolean;
}

const defaultForm: FormData = {
  full_name: '', email: '', phone: '', password: '', confirmPassword: '',
  date_of_birth: '', nrc_passport: '', tpin: '', physical_address: '', province: '',
  bank_name: '', bank_account_number: '',
  next_of_kin_name: '', next_of_kin_phone: '+260', next_of_kin_relation: '',
  doc_id: null, doc_proof: null, doc_selfie: null,
  confirmInfo: false, agreeTerms: false,
};

/* NRC format: 000000/00/0 */
function formatNRC(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '').slice(0, 9);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return digits.slice(0, 6) + '/' + digits.slice(6);
  return digits.slice(0, 6) + '/' + digits.slice(6, 8) + '/' + digits.slice(8, 9);
}

/* TPIN: digits only, max 10 */
function formatTPIN(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 10);
}

/* Next of kin phone: +260 XXXXXXXXX - max 12 digits after + */
function formatNextOfKinPhone(raw: string): string {
  // Always start with +260
  let digits = raw.replace(/[^\d]/g, '');
  // If they cleared everything, reset to 260
  if (!digits.startsWith('260')) {
    digits = '260' + digits.replace(/^260/, '');
  }
  digits = digits.slice(0, 12); // 260 + 9 digits = 12
  return '+' + digits;
}

const SignUp = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeFile, setActiveFile] = useState<'doc_id' | 'doc_proof' | 'doc_selfie' | null>(null);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm(p => ({ ...p, [key]: value }));

  const inputClass = 'w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary';
  const labelClass = 'text-sm font-medium text-foreground block mb-1.5';
  const readOnlyClass = 'w-full bg-secondary/50 rounded-xl px-4 py-3 text-sm text-muted-foreground cursor-not-allowed';

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const strengthColors = { Weak: 'bg-destructive', Fair: 'bg-warning', Strong: 'bg-success' };
  const strengthWidths = { Weak: 'w-1/3', Fair: 'w-2/3', Strong: 'w-full' };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'Full name is required';
    if (!form.email.trim() && !form.phone.trim()) {
      e.email = 'Please provide either an email address or a phone number';
      e.phone = 'Please provide either an email address or a phone number';
    }
    if (!isPasswordStrong(form.password)) e.password = 'Password must be Strong (10+ chars, upper, lower, number, special)';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };


  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!form.date_of_birth) e.date_of_birth = 'Required';
    else {
      const age = (Date.now() - new Date(form.date_of_birth).getTime()) / (365.25 * 86400000);
      if (age < 18) e.date_of_birth = 'Must be 18 or older';
    }
    const nrcDigits = form.nrc_passport.replace(/[^\d]/g, '');
    if (nrcDigits.length !== 9) e.nrc_passport = 'NRC must be 9 digits (000000/00/0)';
    const tpinDigits = form.tpin.replace(/\D/g, '');
    if (tpinDigits.length < 1) e.tpin = 'TPIN is required';
    if (!form.physical_address.trim()) e.physical_address = 'Required';
    if (!form.province) e.province = 'Required';
    if (!form.bank_name.trim()) e.bank_name = 'Required';
    if (!form.bank_account_number.trim()) e.bank_account_number = 'Required';
    if (!form.next_of_kin_name.trim()) e.next_of_kin_name = 'Required';
    const nokDigits = form.next_of_kin_phone.replace(/[^\d]/g, '');
    if (nokDigits.length !== 12) e.next_of_kin_phone = 'Must be +260 followed by 9 digits';
    if (!form.next_of_kin_relation) e.next_of_kin_relation = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFileSelect = (field: 'doc_id' | 'doc_proof' | 'doc_selfie') => {
    setActiveFile(field);
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeFile) {
      // Validate file type and size
      if (!SECURITY_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
        setErrors({ [activeFile]: 'File must be JPG, PNG, WebP, or PDF' });
        return;
      }
      if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE_BYTES) {
        setErrors({ [activeFile]: 'File must be smaller than 10MB' });
        return;
      }
      update(activeFile, file);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!form.confirmInfo || !form.agreeTerms) return;
    setLoading(true);
    setGeneralError('');

    try {
      // Step 1: Register with middleware. The middleware creates the Supabase
      // auth user server-side — never call supabase.auth.signUp from the client,
      // it would create a duplicate unlinked user and break the KYC flow.
      const email = form.email.trim().toLowerCase();
      try {
        await middlewareClient.signupWithPhone({
          full_name: form.full_name.trim(),
          email: email || undefined,
          phone: form.phone.trim() || undefined,
          password: form.password,
        });
      } catch (e: any) {
        const m = String(e?.message || '').toLowerCase();
        if (m.includes('already') || m.includes('exists') || e?.status === 409) {
          setGeneralError('This email is already registered. Tap Sign In below.');
        } else {
          setGeneralError(e?.message || 'Account could not be created. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Step 2: Sign in to establish a Supabase session so the subsequent
      // profile upsert and storage uploads run under the new user's RLS context.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });
      const userId = signInData?.user?.id;
      if (signInError || !userId) {
        setGeneralError('Account created but sign-in failed. Please sign in manually.');
        setLoading(false);
        return;
      }

      // Step 2: Ensure profile exists (upsert — handles trigger race condition)
      try {
        // Wait briefly for the DB trigger
        await new Promise(r => setTimeout(r, 1200));

        const { error: upsertError } = await supabase.from('profiles').upsert({
          id: userId,
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          date_of_birth: form.date_of_birth || null,
          nrc_passport: form.nrc_passport || null,
          tpin: form.tpin || null,
          physical_address: form.physical_address || null,
          province: form.province || null,
          bank_name: form.bank_name || null,
          bank_account_number: form.bank_account_number || null,
          next_of_kin_name: form.next_of_kin_name || null,
          next_of_kin_phone: form.next_of_kin_phone || null,
          next_of_kin_relation: form.next_of_kin_relation || null,
          broker_id: 'MAAL',
          dealer_id: 'MAA',
          kyc_status: 'pending',
          csd_registration_status: 'pending',
          csd_registered: false,
          account_status: 'active',
          wallet_balance: 0.00,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'id', ignoreDuplicates: false });

        if (upsertError) {
          console.error('Profile upsert warning:', upsertError.message);
          // Don't block — user can update profile later
        }
      } catch (profileErr) {
        console.error('Profile creation failed silently:', profileErr);
      }

      // Step 3: Upload documents (non-blocking)
      try {
        const uploadDoc = async (file: File | null, path: string, field: string) => {
          if (!file) return;
          const safeName = sanitizeFilename(file.name);
          const ext = safeName.split('.').pop();
          const fullPath = `${userId}/${path}.${ext}`;
          await supabase.storage.from('kyc-documents').upload(fullPath, file, { upsert: true });
          await supabase.from('profiles').update({ [field]: fullPath } as any).eq('id', userId);
          await logAudit(supabase, userId, 'DOCUMENT_UPLOADED', undefined, undefined, { docType: path });
        };

        await Promise.all([
          uploadDoc(form.doc_id, 'nrc', 'doc_id_path'),
          uploadDoc(form.doc_proof, 'proof_address', 'doc_proof_address_path'),
          uploadDoc(form.doc_selfie, 'selfie', 'doc_selfie_path'),
        ]);
      } catch (docErr) {
        console.error('Document upload failed silently:', docErr);
      }

      try { await logAudit(supabase, userId, 'SIGN_UP'); } catch {}
      // §8A.1 — new accounts always land on /account-pending, not the trading dashboard.
      navigate('/account-pending');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (msg.includes('network') || msg.includes('fetch')) {
        setGeneralError('No internet connection. Please check your network.');
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 pb-24 keyboard-aware">
      <div className="max-w-lg mx-auto space-y-6">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(step - 1) : navigate('/signin')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Create Account</h1>
            <p className="text-xs text-muted-foreground">Step {step} of 4</p>
          </div>
          <img src={circleLogo} alt="AcumenEdge" width={40} height={40} loading="eager" fetchPriority="high" className="w-10 h-10 object-contain" />
        </div>

        {/* Progress */}
        <div className="flex gap-1">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-secondary'}`} />
          ))}
        </div>

        {/* Step 1: Account Details */}
        {step === 1 && (
          <div className="bg-card rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Account Details</h2>
            </div>
            <p className="text-xs text-muted-foreground">Already have an account? <button onClick={() => navigate('/signin')} className="text-primary font-medium">Sign in</button></p>

            <div>
              <label className={labelClass}>Full Legal Name *</label>
              <input value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Enter full name" className={inputClass} />
              {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" className={inputClass} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className={labelClass}>Phone Number *</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+260 9XX XXX XXX" className={inputClass} />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className={labelClass}>Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} placeholder="Min 10 chars, upper, lower, number, special" className={inputClass} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strengthColors[passwordStrength.label]} ${strengthWidths[passwordStrength.label]}`} />
                  </div>
                  <p className={`text-[10px] font-medium ${passwordStrength.label === 'Weak' ? 'text-destructive' : passwordStrength.label === 'Fair' ? 'text-warning' : 'text-success'}`}>
                    {passwordStrength.label} — {passwordStrength.label === 'Strong' ? 'Ready' : 'Needs: 10+ chars, uppercase, lowercase, number, special character'}
                  </p>
                </div>
              )}
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className={labelClass}>Confirm Password *</label>
              <input type="password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="Re-enter password" className={inputClass} />
              {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>}
            </div>

            <button onClick={() => validateStep1() && setStep(2)}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Personal Information */}
        {step === 2 && (
          <div className="bg-card rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Personal Information</h2>
            </div>
            <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning">Required by the Lusaka Securities Exchange to open a trading account</p>
            </div>

            <div>
              <label className={labelClass}>Date of Birth *</label>
              <input type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)}
                max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split('T')[0]} className={inputClass} />
              {errors.date_of_birth && <p className="text-xs text-destructive mt-1">{errors.date_of_birth}</p>}
            </div>
            <div>
              <label className={labelClass}>NRC Number *</label>
              <input value={form.nrc_passport} onChange={e => update('nrc_passport', formatNRC(e.target.value))} placeholder="000000/00/0" className={inputClass} maxLength={11} />
              <p className="text-[10px] text-muted-foreground mt-1">Format: 000000/00/0</p>
              {errors.nrc_passport && <p className="text-xs text-destructive mt-1">{errors.nrc_passport}</p>}
            </div>
            <div>
              <label className={labelClass}>TPIN *</label>
              <input value={form.tpin} onChange={e => update('tpin', formatTPIN(e.target.value))} placeholder="0000000000" className={inputClass} maxLength={10} inputMode="numeric" />
              <p className="text-[10px] text-muted-foreground mt-1">10 digits max — Get your TPIN from zra.org.zm</p>
              {errors.tpin && <p className="text-xs text-destructive mt-1">{errors.tpin}</p>}
            </div>
            <div>
              <label className={labelClass}>Physical Address *</label>
              <input value={form.physical_address} onChange={e => update('physical_address', e.target.value)} placeholder="Full street, suburb, city" className={inputClass} />
              {errors.physical_address && <p className="text-xs text-destructive mt-1">{errors.physical_address}</p>}
            </div>
            <div>
              <label className={labelClass}>Province *</label>
              <div className="relative">
                <select value={form.province} onChange={e => update('province', e.target.value)}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none">
                  <option value="">Select province</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.province && <p className="text-xs text-destructive mt-1">{errors.province}</p>}
            </div>
            <div>
              <label className={labelClass}>Bank Name *</label>
              <input value={form.bank_name} onChange={e => update('bank_name', e.target.value)} placeholder="e.g. Zanaco, Stanbic, FNB" className={inputClass} />
              {errors.bank_name && <p className="text-xs text-destructive mt-1">{errors.bank_name}</p>}
            </div>
            <div>
              <label className={labelClass}>Bank Account Number *</label>
              <input value={form.bank_account_number} onChange={e => update('bank_account_number', e.target.value)} placeholder="Enter account number" className={`${inputClass} font-mono`} />
              {errors.bank_account_number && <p className="text-xs text-destructive mt-1">{errors.bank_account_number}</p>}
            </div>
            <div>
              <label className={labelClass}>Next of Kin Name *</label>
              <input value={form.next_of_kin_name} onChange={e => update('next_of_kin_name', e.target.value)} placeholder="Full name" className={inputClass} />
              {errors.next_of_kin_name && <p className="text-xs text-destructive mt-1">{errors.next_of_kin_name}</p>}
            </div>
            <div>
              <label className={labelClass}>Next of Kin Phone *</label>
              <input value={form.next_of_kin_phone} onChange={e => update('next_of_kin_phone', formatNextOfKinPhone(e.target.value))} placeholder="+260 9XXXXXXXX" className={inputClass} maxLength={13} />
              <p className="text-[10px] text-muted-foreground mt-1">Format: +260 followed by 9 digits</p>
              {errors.next_of_kin_phone && <p className="text-xs text-destructive mt-1">{errors.next_of_kin_phone}</p>}
            </div>
            <div>
              <label className={labelClass}>Relationship *</label>
              <div className="relative">
                <select value={form.next_of_kin_relation} onChange={e => update('next_of_kin_relation', e.target.value)}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none">
                  <option value="">Select relationship</option>
                  {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.next_of_kin_relation && <p className="text-xs text-destructive mt-1">{errors.next_of_kin_relation}</p>}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">
                <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
              </button>
              <button onClick={() => validateStep2() && setStep(3)} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold">
                Next <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Identity Documents */}
        {step === 3 && (
          <div className="bg-card rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Identity Documents</h2>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground">Your documents are encrypted and only shared with your broker to complete your CSD registration. We never sell your data.</p>
            </div>

            {([
              { key: 'doc_id' as const, label: 'NRC front & back or Passport', desc: 'JPG/PNG/PDF max 10MB' },
              { key: 'doc_proof' as const, label: 'Proof of Residence', desc: 'Utility bill or bank statement, under 3 months old' },
              { key: 'doc_selfie' as const, label: 'Selfie holding your NRC or passport', desc: 'Clear face photo' },
            ]).map(doc => (
              <div key={doc.key} className="space-y-1.5">
                <label className={labelClass}>{doc.label}</label>
                <button onClick={() => handleFileSelect(doc.key)}
                  className="w-full flex items-center gap-3 bg-secondary rounded-xl px-4 py-3 text-sm text-left hover:bg-secondary/80 transition-colors">
                  {form[doc.key] ? (
                    <><Check className="w-4 h-4 text-success shrink-0" /><span className="text-success font-medium truncate">{form[doc.key]!.name}</span></>
                  ) : (
                    <><Upload className="w-4 h-4 text-muted-foreground shrink-0" /><span className="text-muted-foreground">{doc.desc}</span></>
                  )}
                </button>
              </div>
            ))}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">
                <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
              </button>
              <button onClick={() => setStep(4)} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold">
                Next <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 4 && (
          <div className="bg-card rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground">Review & Submit</h2>

            <div className="space-y-2 text-sm">
              {([
                ['Name', form.full_name],
                ['Email', form.email],
                ['Phone', form.phone],
                ['Date of Birth', form.date_of_birth],
                ['NRC', form.nrc_passport],
                ['TPIN', form.tpin],
                ['Address', form.physical_address],
                ['Province', form.province],
                ['Bank', `${form.bank_name} — ${form.bank_account_number}`],
                ['Next of Kin', `${form.next_of_kin_name} (${form.next_of_kin_relation})`],
                ['Next of Kin Phone', form.next_of_kin_phone],
                ['Documents', [form.doc_id, form.doc_proof, form.doc_selfie].filter(Boolean).length + ' of 3 uploaded'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground font-medium text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={form.confirmInfo} onChange={e => update('confirmInfo', e.target.checked)}
                className="mt-0.5 accent-primary" />
              I confirm all information is accurate and I am the account holder
            </label>
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={form.agreeTerms} onChange={e => update('agreeTerms', e.target.checked)}
                className="mt-0.5 accent-primary" />
              I agree to Money Acumen Terms of Service and Privacy Policy
            </label>

            {generalError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <p className="text-xs text-destructive">{generalError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">
                <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
              </button>
              <button onClick={handleSubmit} disabled={loading || !form.confirmInfo || !form.agreeTerms}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignUp;
