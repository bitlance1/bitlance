'use client';

import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from '@/components/molecules/ChatHeader';
import ChatMessage from '@/components/molecules/ChatMessage';
import Button from '@/components/atoms/Button';
import { Copy, Send, Paperclip, X, ShieldCheck, BriefcaseBusiness } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';
import DisputeFormModal from '@/components/organisms/DisputeFormModal';

interface Message {
  id: string;
  sender: {
    name: string;
    avatar: string;
    isOnline: boolean;
    profileUrl?: string;
  };
  lastMessage: {
    text: string;
    timestamp: string;
    isRead: boolean;
  };
  unreadCount: number;
}

interface ChatMessageType {
  id: string;
  sender: 'me' | 'them';
  text: string;
  timestamp: string;
  isRead?: boolean;
  attachment?: {
    name: string;
    size: string;
    url?: string;
    mimeType?: string;
    resourceType?: string;
  };
}

type FundingMode = 'full' | 'per_milestone';

interface EscrowMilestone {
  index: number;
  title: string;
  freelancerAmountSats: number;
  platformFeeSats: number;
  totalClientPaysSats: number;
  fundedSats?: number;
  releasedSats?: number;
  status?: 'pending' | 'funded' | 'submitted' | 'approved' | 'released';
}

interface ChatViewProps {
  message: Message;
  chatMessages: ChatMessageType[];
  onBack: () => void;
  onSendMessage?: (text: string, file?: File | null) => void | Promise<void>;
  canSend?: boolean;
  viewerRole?: 'client' | 'freelancer';
  paymentStatus?: 'unfunded' | 'invoice_created' | 'funded' | 'released' | 'disputed' | 'expired';
  paymentAmountSats?: number;
  paymentTotalAmountSats?: number;
  proposedRate?: number;
  paymentInstallments?: number;
  paymentCurrentInstallment?: number;
  paymentPaidAmountSats?: number;
  paymentTotalChargedSats?: number;
  platformFeePercent?: number;
  platformFeeSats?: number;
  paymentMode?: FundingMode;
  milestones?: EscrowMilestone[];
  paymentRequest?: string;
  workStatus?: 'not_started' | 'in_progress' | 'submitted' | 'changes_requested' | 'approved' | 'completed';
  onCreatePaymentInvoice?: (options: {
    installments: number;
    fundingMode: FundingMode;
    milestoneTitles: string[];
    chosenAmount?: number;
  }) => Promise<string | void>;
  onVerifyPayment?: (paymentRequest?: string) => Promise<'funded' | 'pending' | 'expired'>;
  onSubmitWork?: (payload: { description: string; link: string; file?: File | null }) => Promise<void>;
  submittedWorkHref?: string;
  onApproveSubmission?: () => Promise<void>;
  onRequestChanges?: (note: string) => Promise<void>;
  onOpenContractModal?: (contractId: string) => void;
  pendingSubmissionJob?: {
    id: string;
    contractId: string;
    description: string;
    link?: string;
    attachment?: { name?: string; url?: string } | null;
    submittedAt: Date;
    status: "pending" | "approved" | "rejected";
    revisionMessage?: string;
    milestoneIndex?: number;
    milestoneTitle?: string;
  } | null;
  jobId?: string;
  jobTitle?: string;
  contractId?: string;
  /** Override the role used for the dispute form (defaults to viewerRole) */
  viewerRole_disputeRole?: 'client' | 'freelancer';
}export default function ChatView({
  message,
  chatMessages,
  onBack,
  onSendMessage,
  canSend = true,
  viewerRole = 'client',
  paymentStatus = 'unfunded',
  paymentAmountSats,
  paymentTotalAmountSats,
  proposedRate,
  paymentInstallments,
  paymentCurrentInstallment,
  paymentPaidAmountSats = 0,
  paymentTotalChargedSats,
  platformFeePercent = 5,
  platformFeeSats,
  paymentMode = 'full',
  milestones = [],
  paymentRequest,
  workStatus = 'not_started',
  onCreatePaymentInvoice,
  onVerifyPayment,
  onSubmitWork,
  submittedWorkHref,
  onApproveSubmission,
  onRequestChanges,
  onOpenContractModal,
  pendingSubmissionJob,
  jobId,
  jobTitle,
  contractId,
  viewerRole_disputeRole,
}: ChatViewProps) {
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [jobDetails, setJobDetails] = useState<any | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [selectedFundingMode, setSelectedFundingMode] = useState<FundingMode>('full');
  const [milestoneTitles, setMilestoneTitles] = useState<string[]>(['Complete project']);
  const [activePaymentRequest, setActivePaymentRequest] = useState('');
  const [invoiceCopied, setInvoiceCopied] = useState(false);
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);
  const [isWorkExpanded, setIsWorkExpanded] = useState(false);
  // Price choice: null = not yet chosen, 'proposed' | 'job_budget'
  const [priceChoice, setPriceChoice] = useState<'proposed' | 'job_budget' | null>(null);
  const [workDescription, setWorkDescription] = useState('');
  const [workLink, setWorkLink] = useState('');
  const [workFile, setWorkFile] = useState<File | null>(null);
  const [isSubmittingWork, setIsSubmittingWork] = useState(false);
  const [workError, setWorkError] = useState('');
  const [workSuccess, setWorkSuccess] = useState('');
  const [changeRequestNote, setChangeRequestNote] = useState('');
  const [isSendingChangeRequest, setIsSendingChangeRequest] = useState(false);
  const [approveError, setApproveError] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasPaidMilestone = paymentPaidAmountSats > 0 || paymentStatus === 'funded' || paymentStatus === 'released';
  const totalAmount = paymentTotalAmountSats || paymentAmountSats || 0;
  const storedPlatformFee = Number(platformFeeSats ?? 0);
  const computedPlatformFee =
    storedPlatformFee > 0 ? storedPlatformFee : Math.ceil(totalAmount * (platformFeePercent / 100));
  const clientPayableTotal =
    paymentTotalChargedSats && paymentTotalChargedSats > 0
      ? paymentTotalChargedSats
      : totalAmount + computedPlatformFee;
  const activeInstallments = Math.max(
    1,
    Math.min(3, hasPaidMilestone ? paymentInstallments || 1 : selectedInstallments || paymentInstallments || 1)
  );
  const activeMilestone = Math.max(1, Math.min(activeInstallments, paymentCurrentInstallment || 1));
  const activeMilestoneData =
    milestones.find((milestone) => milestone.index === activeMilestone) ?? null;
  const hasOpenFundedMilestone = milestones.some(
    (milestone) =>
      milestone.releasedSats === 0 &&
      (milestone.status === 'funded' || milestone.status === 'submitted' || milestone.status === 'approved')
  );
  const showCurrentInvoice =
    paymentStatus === 'invoice_created' &&
    !!paymentRequest;
  const canChoosePlan =
    viewerRole === 'client' &&
    !hasPaidMilestone &&
    (paymentStatus === 'unfunded' ||
      paymentStatus === 'expired' ||
      (paymentStatus === 'invoice_created' && !showCurrentInvoice));
  const canCreateInvoice =
    viewerRole === 'client' &&
    paymentStatus !== 'released' &&
    (paymentStatus !== 'invoice_created' || !showCurrentInvoice) &&
    !(paymentStatus === 'funded' && activeMilestone >= activeInstallments) &&
    !(paymentStatus === 'funded' && hasOpenFundedMilestone);
  const canSubmitWork =
    viewerRole === 'freelancer' &&
    !!onSubmitWork &&
    paymentStatus === 'funded' &&
    workStatus !== 'submitted' &&
    workStatus !== 'approved' &&
    workStatus !== 'completed';
  const splitAmount = (installment: number, count = selectedInstallments) => {
    if (!totalAmount) return 0;
    const base = Math.floor(totalAmount / count);
    const remainder = totalAmount % count;
    return base + (installment <= remainder ? 1 : 0);
  };
  const splitClientAmount = (installment: number, count = selectedInstallments) => {
    if (!clientPayableTotal) return 0;
    const base = Math.floor(clientPayableTotal / count);
    const remainder = clientPayableTotal % count;
    return base + (installment <= remainder ? 1 : 0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInternalLinkClick = (url: string) => {
    setIsWorkExpanded(true);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    setActivePaymentRequest('');
    setPaymentError('');
    setInvoiceCopied(false);
  }, [message.id]);

  useEffect(() => {
    setMilestoneTitles((prev) =>
      Array.from({ length: selectedInstallments }, (_, index) => {
        const existing = prev[index] || milestones[index]?.title;
        return existing || (selectedInstallments === 1 ? 'Complete project' : `Milestone ${index + 1}`);
      })
    );
  }, [selectedInstallments]);

  useEffect(() => {
    if (!showCurrentInvoice || !onVerifyPayment || verificationComplete) return;

    const interval = window.setInterval(() => {
      void handleVerifyPayment({ silent: true });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [showCurrentInvoice, onVerifyPayment, verificationComplete]);

  useEffect(() => {
    setVerificationComplete(paymentStatus === 'funded' || paymentStatus === 'released');
    if (paymentStatus === 'invoice_created' && paymentRequest) {
      setActivePaymentRequest(paymentRequest);
      return;
    }
    if (paymentStatus !== 'invoice_created') {
      setActivePaymentRequest('');
    }
  }, [paymentRequest, paymentStatus]);

  const handleSendMessage = async () => {
    if (!canSend || isSending) return;
    const text = newMessage.trim();
    if (!text && !selectedFile) return;

    try {
      setIsSending(true);
      if (onSendMessage) {
        await onSendMessage(text, selectedFile);
      }
      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const openFilePicker = () => {
    if (!canSend || isSending) return;
    fileInputRef.current?.click();
  };

  const handleCreatePaymentInvoice = async () => {
    if (!onCreatePaymentInvoice || isCreatingInvoice) return;

    try {
      setIsCreatingInvoice(true);
      setPaymentError('');
      const normalizedTitles = milestoneTitles
        .slice(0, selectedInstallments)
        .map((title, index) => title.trim() || `Milestone ${index + 1}`);

      // Resolve the chosen amount
      const showPriceChoice = !hasPaidMilestone && proposedRate && proposedRate > 0 && proposedRate !== totalAmount;
      let chosenAmount: number | undefined;
      if (showPriceChoice) {
        if (priceChoice === 'proposed') chosenAmount = proposedRate;
        else if (priceChoice === 'job_budget') chosenAmount = totalAmount;
        else {
          setPaymentError('Please choose which price you want to pay before generating the invoice.');
          return;
        }
      }

      const newPaymentRequest = await onCreatePaymentInvoice({
        installments: selectedInstallments,
        fundingMode: selectedFundingMode,
        milestoneTitles: normalizedTitles,
        chosenAmount,
      });
      if (newPaymentRequest) {
        setActivePaymentRequest(newPaymentRequest);
        setInvoiceCopied(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create payment invoice.';
      setPaymentError(message);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleCopyInvoice = async () => {
    if (!activePaymentRequest) return;

    try {
      await navigator.clipboard.writeText(activePaymentRequest);
      setInvoiceCopied(true);
      window.setTimeout(() => setInvoiceCopied(false), 1800);
    } catch {
      setPaymentError('Unable to copy invoice. Select and copy it manually.');
    }
  };

  const handleVerifyPayment = async (options?: { silent?: boolean }) => {
    if (!onVerifyPayment || isVerifyingPayment) return;

    try {
      setIsVerifyingPayment(true);
      if (!options?.silent) setPaymentError('');
      const result = await onVerifyPayment(activePaymentRequest || paymentRequest);
      if (result === 'funded' || result === 'expired') {
        setVerificationComplete(true);
      }
      if (result === 'pending' && !options?.silent) {
        setPaymentError('Payment is not received yet. Try again after the client pays.');
      }
      if (result === 'expired' && !options?.silent) {
        setPaymentError('This Lightning invoice has expired. Generate a new invoice.');
      }
    } catch (error) {
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : 'Unable to verify payment.';
        setPaymentError(message);
      }
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handleApproveSubmission = async () => {
    if (!onApproveSubmission || isApproving) return;

    try {
      setApproveError('');
      setIsApproving(true);
      await onApproveSubmission();
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : 'Unable to approve submission.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendChangeRequest = async () => {
    if (!onRequestChanges || isSendingChangeRequest) return;
    const note = changeRequestNote.trim();
    if (!note) {
      setApproveError('Write a short note so the freelancer knows what to adjust.');
      return;
    }

    try {
      setApproveError('');
      setIsSendingChangeRequest(true);
      await onRequestChanges(note);
      setChangeRequestNote('');
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : 'Unable to request changes.');
    } finally {
      setIsSendingChangeRequest(false);
    }
  };

  const handleSubmitWork = async () => {
    if (!onSubmitWork || isSubmittingWork) return;
    const description = workDescription.trim();
    const link = workLink.trim();
    if (!description && !link && !workFile) {
      setWorkError('Add a delivery note, link, or file before submitting.');
      return;
    }

    try {
      setIsSubmittingWork(true);
      setWorkError('');
      setWorkSuccess('');
      await onSubmitWork({ description, link, file: workFile });
      setWorkDescription('');
      setWorkLink('');
      setWorkFile(null);
      if (workFileInputRef.current) workFileInputRef.current.value = '';
      setWorkSuccess('Work submitted for client review.');
      setIsWorkExpanded(false);
    } catch (error) {
      setWorkError(error instanceof Error ? error.message : 'Unable to submit work. Please try again.');
    } finally {
      setIsSubmittingWork(false);
    }
  };

  const paymentLabel =
    paymentStatus === 'funded'
      ? activeMilestone < activeInstallments
        ? `Milestone ${activeMilestone} funded`
        : 'Escrow funded'
      : paymentStatus === 'invoice_created'
        ? `Milestone ${activeMilestone} invoice created`
        : paymentStatus === 'released'
          ? 'Payment released'
          : paymentStatus === 'disputed'
            ? 'Payment disputed'
            : paymentStatus === 'expired'
              ? 'Invoice expired'
              : 'Payment not funded';

  const paymentCopy =
    viewerRole === 'client'
      ? paymentStatus === 'funded'
        ? activeMilestone < activeInstallments
          ? 'This milestone is funded. Create the next milestone invoice when you are ready.'
          : 'The freelancer can start work now.'
        : paymentStatus === 'invoice_created'
          ? showCurrentInvoice
            ? 'Pay this Lightning invoice to fund the contract.'
            : 'That invoice was from a previous session. Generate a fresh Lightning invoice before paying.'
          : paymentStatus === 'expired'
            ? 'Generate a fresh Lightning invoice before the freelancer starts work.'
            : 'Generate a Lightning invoice before the freelancer starts work.'
      : paymentStatus === 'funded'
        ? activeMilestone < activeInstallments
          ? 'This milestone is funded. Wait for the next milestone invoice before starting the next phase.'
          : 'Payment is funded. You can start work.'
        : paymentStatus === 'invoice_created'
          ? 'The client has generated a Lightning invoice. Wait for funding confirmation before starting.'
          : paymentStatus === 'expired'
            ? 'The invoice expired. Ask the client to generate a fresh invoice.'
            : 'Waiting for the client to fund this contract.';

  const workLabel =
    workStatus === 'submitted'
      ? 'Work submitted'
      : workStatus === 'changes_requested'
        ? 'Changes requested'
        : workStatus === 'approved'
          ? 'Milestone approved'
          : workStatus === 'completed'
            ? 'Contract completed'
            : paymentStatus === 'funded'
              ? 'Ready for work'
              : 'Work locked';

  const workCopy =
    viewerRole === 'freelancer'
      ? workStatus === 'submitted'
        ? 'Your submission is waiting for client review.'
        : workStatus === 'changes_requested'
          ? 'The client requested updates. Submit the revised work when ready.'
          : workStatus === 'approved'
            ? activeMilestone < activeInstallments
              ? 'This milestone was approved. Wait for the next milestone to be funded.'
              : 'Your work was approved.'
            : paymentStatus === 'funded'
              ? 'Submit finished work for this funded milestone.'
              : 'Wait until escrow is funded before submitting work.'
      : workStatus === 'submitted'
        ? 'Review the submitted work, then approve it or request changes.'
        : workStatus === 'changes_requested'
          ? 'Waiting for the freelancer to submit revised work.'
          : workStatus === 'approved'
            ? activeMilestone < activeInstallments
              ? 'Milestone approved. Create the next milestone invoice when ready.'
              : 'Milestone approved.'
            : paymentStatus === 'funded'
              ? 'The freelancer can submit work for this funded milestone.'
      : 'Fund the milestone before work is submitted.';

  return (
  <>
    <div className="flex h-full min-h-0 flex-col bg-[#FCF9F7CC]">
      {/* Header */}
        <ChatHeader
          sender={message.sender}
          onBack={onBack}
          onViewJobDetails={() => {
            // Open job detail modal using jobId prop
            if (!jobId) return;
            setLoadingJob(true);
            const loadJob = async () => {
              try {
                const jobSnap = await getDoc(doc(firebaseDb, 'jobs', jobId));
                if (jobSnap.exists()) {
                  setJobDetails({ id: jobSnap.id, ...jobSnap.data() });
                  setIsJobModalOpen(true);
                } else {
                  console.error('Job not found');
                }
              } catch (err) {
                console.error('Failed to fetch job', err);
              } finally {
                setLoadingJob(false);
              }
            };
            void loadJob();
          }}
          onRaiseDispute={() => setIsDisputeModalOpen(true)}
        />
        {/* Job Details Modal */}
        {isJobModalOpen && jobDetails && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 px-0 sm:items-center sm:px-4" onClick={() => setIsJobModalOpen(false)}>
            <div
              className="max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] bg-white pb-6 shadow-2xl sm:max-w-lg sm:rounded-[18px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EAE7E2] bg-white px-5 py-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8C4F00]">Job Details</div>
                  <h3 className="mt-0.5 text-[18px] font-black text-[#1a1a1a] leading-tight">{jobDetails.title || 'N/A'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsJobModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Body */}
              <div className="space-y-4 px-5 pt-4">
                {/* Budget + Type row */}
                <div className="flex flex-wrap gap-2">
                  {jobDetails.budget && (
                    <span className="inline-flex items-center rounded-full border border-[#EAE7E2] bg-[#FFF4E6] px-3 py-1 text-[12px] font-bold text-[#8C4F00]">
                      {String(jobDetails.budget).toLowerCase().includes('sats') ? jobDetails.budget : `${jobDetails.budget} sats`}
                    </span>
                  )}
                  {jobDetails.pricingType && (
                    <span className="inline-flex items-center rounded-full border border-[#EAE7E2] bg-[#F7F6F3] px-3 py-1 text-[12px] font-semibold text-[#6b6762]">
                      {jobDetails.pricingType}
                    </span>
                  )}
                  {jobDetails.category && (
                    <span className="inline-flex items-center rounded-full border border-[#EAE7E2] bg-[#F7F6F3] px-3 py-1 text-[12px] font-semibold text-[#6b6762]">
                      {jobDetails.category}
                    </span>
                  )}
                  {jobDetails.duration && (
                    <span className="inline-flex items-center rounded-full border border-[#EAE7E2] bg-[#F7F6F3] px-3 py-1 text-[12px] font-semibold text-[#6b6762]">
                      {jobDetails.duration}
                    </span>
                  )}
                </div>
                {/* Description */}
                {jobDetails.description && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9e9690]">Description</div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#1a1a1a]">{jobDetails.description}</p>
                  </div>
                )}
                {/* Skills */}
                {Array.isArray(jobDetails.skills) && jobDetails.skills.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9e9690]">Skills</div>
                    <div className="flex flex-wrap gap-1.5">
                      {jobDetails.skills.map((skill: string, i: number) => (
                        <span key={i} className="rounded-full border border-[#EAE7E2] bg-[#F7F6F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#6b6762]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Scope items */}
                {Array.isArray(jobDetails.scopeItems) && jobDetails.scopeItems.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9e9690]">Scope of Work</div>
                    <ul className="space-y-1">
                      {jobDetails.scopeItems.map((item: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-[#1a1a1a]">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8C4F00]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Company */}
                {(jobDetails.company || jobDetails.companyName) && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9e9690]">Company</div>
                    <p className="text-[13px] font-semibold text-[#1a1a1a]">{jobDetails.company || jobDetails.companyName}</p>
                  </div>
                )}
                {/* Location */}
                {jobDetails.location && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9e9690]">Location</div>
                    <p className="text-[13px] text-[#1a1a1a]">{jobDetails.location}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {loadingJob && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30">
            <div className="rounded-xl bg-white px-6 py-4 text-[13px] font-semibold text-[#1a1a1a] shadow-lg">Loading job details…</div>
          </div>
        )}

      <div className="border-b border-[#e8e6e1] bg-white px-3 py-2 sm:px-5">
        {/* Payment Section - Collapsible */}
        <div className="grid grid-cols-2 gap-2">
          {/* Payment Header - Always Visible */}
          <button
            type="button"
            onClick={() => setIsPaymentExpanded(!isPaymentExpanded)}
            className="min-w-0 rounded-[14px] border border-[#EAE7E2] bg-[#F7F6F3] px-3 py-2.5 text-left transition-colors hover:bg-[#f0ede8]"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF4E6] text-[#8C4F00]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8C4F00]">
                  Escrow
                </div>
                <div className="mt-0.5 truncate text-[12px] font-black text-[#1a1a1a]">{paymentLabel}</div>
              </div>
            </div>
          </button>

          {/* Payment Details - Expandable */}
          {isPaymentExpanded && (
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 px-0 sm:items-center sm:px-4" onClick={() => setIsPaymentExpanded(false)}>
            <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border border-[#EAE7E2] bg-white px-4 pb-5 pt-4 shadow-[0_20px_70px_rgba(0,0,0,0.25)] sm:max-w-xl sm:rounded-[18px] sm:px-5" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8C4F00]">Bitlance Escrow</div>
                  <h3 className="mt-1 text-[18px] font-black text-[#1a1a1a]">{paymentLabel}</h3>
                </div>
                <button type="button" onClick={() => setIsPaymentExpanded(false)} className="rounded-full border border-[#EAE7E2] p-2 text-[#6b6762]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
              <div>
                <p className="text-[11px] leading-5 text-[#6b6762]">{paymentCopy}</p>
                {paymentAmountSats ? (
                  <p className="mt-1 text-[11px] font-semibold text-[#8C4F00]">
                    {paymentAmountSats.toLocaleString()} sats
                    {activeInstallments > 1 ? ` invoice for milestone ${activeMilestone} of ${activeInstallments}` : ''}
                  </p>
                ) : null}
                {activeMilestoneData ? (
                  <p className="mt-1 text-[11px] text-[#6b6762]">
                    Current milestone: {activeMilestoneData.title}
                  </p>
                ) : null}
                {totalAmount ? (
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-[#6b6762] sm:grid-cols-3">
                    <span>Job: {totalAmount.toLocaleString()} sats</span>
                    <span>Platform fee ({platformFeePercent}%): {computedPlatformFee.toLocaleString()} sats</span>
                    <span>Client total: {clientPayableTotal.toLocaleString()} sats</span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {canCreateInvoice ? (
                  <Button
                    size="sm"
                    onClick={() => void handleCreatePaymentInvoice()}
                    disabled={isCreatingInvoice}
                    className="rounded-full"
                  >
                    {isCreatingInvoice
                      ? 'Generating...'
                      : paymentStatus === 'expired'
                        ? 'Generate Fresh Invoice'
                        : paymentStatus === 'invoice_created' && !showCurrentInvoice
                          ? 'Generate Fresh Invoice'
                          : paymentStatus === 'funded' && activeMilestone < activeInstallments
                            ? 'Create Next Milestone'
                            : 'Fund Contract'}
                  </Button>
                ) : null}
                {showCurrentInvoice && onVerifyPayment ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleVerifyPayment()}
                    disabled={isVerifyingPayment}
                    className="rounded-full"
                  >
                    {isVerifyingPayment ? 'Checking...' : 'Check Payment'}
                  </Button>
                ) : null}
              </div>

              {paymentError ? (
                <p className="rounded-[10px] border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {paymentError}
                </p>
              ) : null}

              {canChoosePlan ? (
                <div className="rounded-[10px] border border-[#EAE7E2] bg-white px-3 py-3">

                  {/* ── Price choice — only shown when proposal rate differs from job budget ── */}
                  {!hasPaidMilestone && proposedRate && proposedRate > 0 && proposedRate !== totalAmount ? (
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C4F00] mb-2">
                        Which price are you paying?
                      </div>
                      <p className="text-[11px] text-[#6b6762] mb-3">
                        The freelancer proposed <span className="font-black text-[#1a1a1a]">{proposedRate.toLocaleString()} sats</span>. The job budget is <span className="font-black text-[#1a1a1a]">{totalAmount.toLocaleString()} sats</span>.
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setPriceChoice('proposed')}
                          className={`rounded-[10px] border px-3 py-3 text-left transition ${
                            priceChoice === 'proposed'
                              ? 'border-[#CC7000] bg-[#FFF4E6]'
                              : 'border-[#EAE7E2] bg-[#F7F6F3] hover:bg-[#FFF4E6]/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${priceChoice === 'proposed' ? 'border-[#CC7000] bg-[#CC7000]' : 'border-[#C8A87A]'}`}>
                              {priceChoice === 'proposed' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-[#1a1a1a]">Freelancer's proposed price</p>
                              <p className="text-[13px] font-black text-[#8C4F00]">{proposedRate.toLocaleString()} sats</p>
                              <p className="text-[10px] text-[#6b6762] mt-0.5">+ {Math.ceil(proposedRate * (platformFeePercent ?? 5) / 100).toLocaleString()} sats platform fee</p>
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPriceChoice('job_budget')}
                          className={`rounded-[10px] border px-3 py-3 text-left transition ${
                            priceChoice === 'job_budget'
                              ? 'border-[#CC7000] bg-[#FFF4E6]'
                              : 'border-[#EAE7E2] bg-[#F7F6F3] hover:bg-[#FFF4E6]/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${priceChoice === 'job_budget' ? 'border-[#CC7000] bg-[#CC7000]' : 'border-[#C8A87A]'}`}>
                              {priceChoice === 'job_budget' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-[#1a1a1a]">Job budget</p>
                              <p className="text-[13px] font-black text-[#8C4F00]">{totalAmount.toLocaleString()} sats</p>
                              <p className="text-[10px] text-[#6b6762] mt-0.5">+ {Math.ceil(totalAmount * (platformFeePercent ?? 5) / 100).toLocaleString()} sats platform fee</p>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C4F00]">
                    Milestone schedule
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setSelectedInstallments(count)}
                        className={`rounded-full border px-3 py-2 text-[11px] font-semibold transition ${
                          selectedInstallments === count
                            ? 'border-[#CC7000] bg-[#FFF4E6] text-[#8C4F00]'
                            : 'border-[#EAE7E2] bg-[#F7F6F3] text-[#6b6762]'
                        }`}
                      >
                        {count === 1 ? '1 milestone' : `${count} milestones`}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {Array.from({ length: selectedInstallments }, (_, index) => (
                      <label key={index} className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9e9690]">
                          Milestone {index + 1} title
                        </span>
                        <input
                          value={milestoneTitles[index] ?? ''}
                          onChange={(event) => {
                            const next = [...milestoneTitles];
                            next[index] = event.target.value;
                            setMilestoneTitles(next);
                          }}
                          placeholder={`What should the freelancer submit for milestone ${index + 1}?`}
                          className="mt-1 w-full rounded-[10px] border border-[#EAE7E2] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { value: 'full' as FundingMode, label: 'Pay full escrow now' },
                      { value: 'per_milestone' as FundingMode, label: 'Pay per milestone' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedFundingMode(option.value)}
                        className={`rounded-[10px] border px-3 py-2 text-left text-[11px] font-semibold transition ${
                          selectedFundingMode === option.value
                            ? 'border-[#CC7000] bg-[#FFF4E6] text-[#8C4F00]'
                            : 'border-[#EAE7E2] bg-[#F7F6F3] text-[#6b6762]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {totalAmount ? (
                    (() => {
                      // Use chosen price if available, otherwise fall back to job budget total
                      const showPriceChoice = !hasPaidMilestone && proposedRate && proposedRate > 0 && proposedRate !== totalAmount;
                      const effectiveBase = showPriceChoice && priceChoice === 'proposed' ? proposedRate! : totalAmount;
                      const effectiveFee = Math.ceil(effectiveBase * (platformFeePercent ?? 5) / 100);
                      const effectiveTotal = effectiveBase + effectiveFee;
                      const effectiveSplit1 = (() => {
                        const base = Math.floor(effectiveTotal / selectedInstallments);
                        const rem = effectiveTotal % selectedInstallments;
                        return base + (1 <= rem ? 1 : 0);
                      })();
                      const effectiveFreelancerSplit1 = (() => {
                        const base = Math.floor(effectiveBase / selectedInstallments);
                        const rem = effectiveBase % selectedInstallments;
                        return base + (1 <= rem ? 1 : 0);
                      })();
                      return (
                        <p className="mt-2 text-[11px] leading-5 text-[#6b6762]">
                          {selectedFundingMode === 'full'
                            ? `Invoice: ${effectiveTotal.toLocaleString()} sats. This includes ${effectiveFee.toLocaleString()} sats platform fee. Releases still happen per milestone.`
                            : `First invoice: ${effectiveSplit1.toLocaleString()} sats. Freelancer portion: ${effectiveFreelancerSplit1.toLocaleString()} sats, with the platform fee included.`}
                        </p>
                      );
                    })()
                  ) : (
                    <p className="mt-2 text-[11px] leading-5 text-[#6b6762]">
                      Add a contract budget before creating an escrow invoice.
                    </p>
                  )}
                </div>
              ) : null}

              {viewerRole === 'client' && showCurrentInvoice ? (
                <div className="grid gap-3 sm:grid-cols-[140px_1fr] sm:items-center">
                  <div className="flex h-[140px] w-[140px] items-center justify-center rounded-[10px] border border-[#EAE7E2] bg-white">
                    <QRCodeSVG value={`lightning:${activePaymentRequest || paymentRequest}`} size={120} />
                  </div>
                  <div className="rounded-[10px] bg-white p-2">
                    <p className="break-all px-1 py-1 text-[11px] leading-5 text-[#6b6762]">
                      {activePaymentRequest || paymentRequest}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleCopyInvoice()}
                      className="mt-2 rounded-full"
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {invoiceCopied ? 'Copied' : 'Copy Invoice'}
                    </Button>
                  </div>
                </div>
              ) : null}
              </div>
            </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsWorkExpanded(!isWorkExpanded)}
            className="min-w-0 rounded-[14px] border border-[#EAE7E2] bg-[#F7F6F3] px-3 py-2.5 text-left transition-colors hover:bg-[#f0ede8]"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF4E6] text-[#8C4F00]">
                <BriefcaseBusiness className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8C4F00]">
                  Work
                </div>
                <div className="mt-0.5 truncate text-[12px] font-black text-[#1a1a1a]">{workLabel}</div>
              </div>
            </div>
          </button>

          {isWorkExpanded && (
            <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 px-0 sm:items-center sm:px-4" onClick={() => setIsWorkExpanded(false)}>
            <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border border-[#EAE7E2] bg-white px-4 pb-5 pt-4 shadow-[0_20px_70px_rgba(0,0,0,0.25)] sm:max-w-xl sm:rounded-[18px] sm:px-5" onClick={(event) => event.stopPropagation()}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8C4F00]">Work Delivery</div>
                  <h3 className="mt-1 text-[18px] font-black text-[#1a1a1a]">{workLabel}</h3>
                </div>
                <button type="button" onClick={() => setIsWorkExpanded(false)} className="rounded-full border border-[#EAE7E2] p-2 text-[#6b6762]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
              <p className="text-[11px] leading-5 text-[#6b6762]">{workCopy}</p>
              {activeMilestoneData ? (
                <p className="rounded-[10px] bg-white px-3 py-2 text-[11px] font-semibold text-[#8C4F00]">
                  Current milestone: {activeMilestoneData.title}
                </p>
              ) : null}

              {canSubmitWork ? (
                <div className="rounded-[10px] border border-[#EAE7E2] bg-white p-3">
                  <div className="grid gap-2">
                    <textarea
                      value={workDescription}
                      onChange={(event) => setWorkDescription(event.target.value)}
                      placeholder="Describe what you delivered..."
                      rows={3}
                      className="w-full rounded-[10px] border border-[#EAE7E2] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
                    />
                    <input
                      value={workLink}
                      onChange={(event) => setWorkLink(event.target.value)}
                      placeholder="Delivery link, preview URL, or repository link"
                      className="w-full rounded-[10px] border border-[#EAE7E2] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20"
                    />
                    <input
                      ref={workFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(event) => setWorkFile(event.target.files?.[0] ?? null)}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => workFileInputRef.current?.click()}
                        className="inline-flex items-center justify-center rounded-full border border-[#EAE7E2] bg-[#F7F6F3] px-3 py-2 text-[11px] font-semibold text-[#6b6762]"
                      >
                        <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                        {workFile ? workFile.name : 'Attach file'}
                      </button>
                      <Button
                        size="sm"
                        onClick={() => void handleSubmitWork()}
                        disabled={isSubmittingWork}
                        className="rounded-full"
                      >
                        {isSubmittingWork ? 'Submitting...' : workStatus === 'changes_requested' ? 'Resubmit Work' : 'Submit Work'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {viewerRole === 'client' && workStatus === 'submitted' && pendingSubmissionJob ? (
                <div className="space-y-3">
                  <div className="rounded-[10px] border border-[#EAE7E2] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6762]">Submitted work</p>
                        {pendingSubmissionJob.milestoneIndex ? (
                          <p className="mt-1 text-[12px] font-bold text-[#1a1a1a]">Milestone {pendingSubmissionJob.milestoneIndex}{pendingSubmissionJob.milestoneTitle ? `: ${pendingSubmissionJob.milestoneTitle}` : ''}</p>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-gray-500">{pendingSubmissionJob.submittedAt.toLocaleDateString()}</p>
                    </div>
                    <p className="mt-3 text-[13px] text-[#1a1a1a]">{pendingSubmissionJob.description || 'Work submitted for review.'}</p>
                    {pendingSubmissionJob.link ? (
                      <a href={pendingSubmissionJob.link} target="_blank" rel="noreferrer" className="mt-3 block text-[12px] text-blue-600 hover:underline break-all">{pendingSubmissionJob.link}</a>
                    ) : null}
                    {pendingSubmissionJob.attachment?.url ? (
                      <a href={pendingSubmissionJob.attachment.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-[#F7F6F3] px-3 py-2 text-[12px] text-gray-700 hover:bg-[#EFEDE8]">📎 {pendingSubmissionJob.attachment.name || 'Attachment'}</a>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" onClick={() => void handleApproveSubmission()} className="rounded-full bg-green-600 text-white hover:bg-green-700" disabled={isApproving || isSendingChangeRequest}>
                      {isApproving ? 'Approving...' : 'Approve & Pay'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setChangeRequestNote('Write a short note for the freelancer...')} className="rounded-full border-gray-300 text-gray-700 hover:bg-gray-50" disabled={isApproving || isSendingChangeRequest}>
                      Request Changes
                    </Button>
                  </div>
                  <div className="rounded-[10px] border border-[#EAE7E2] bg-white p-3">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b6762]">Adjustment note</label>
                    <textarea
                      value={changeRequestNote}
                      onChange={(e) => setChangeRequestNote(e.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-[10px] border border-[#EAE7E2] bg-[#FAF8F5] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-orange-400/20 resize-none"
                      placeholder="Explain what should be updated before resubmission"
                    />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <Button size="sm" variant="outline" onClick={() => setChangeRequestNote('')} className="rounded-full">
                        Clear
                      </Button>
                      <Button size="sm" onClick={() => void handleSendChangeRequest()} className="rounded-full bg-orange-500 text-white hover:bg-orange-600" disabled={isSendingChangeRequest || isApproving}>
                        {isSendingChangeRequest ? 'Sending...' : 'Send Request'}
                      </Button>
                    </div>
                  </div>
                  {approveError ? (
                    <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[11px] text-red-700">{approveError}</p>
                  ) : null}
                </div>
              ) : viewerRole === 'client' && workStatus === 'submitted' && submittedWorkHref ? (
                <Button size="sm" className="rounded-full" onClick={() => setIsWorkExpanded(true)}>
                  Review submission details
                </Button>
              ) : null}

              {workSuccess ? <p className="rounded-[10px] bg-green-50 px-3 py-2 text-[11px] text-green-700">{workSuccess}</p> : null}
              {workError ? <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[11px] text-red-700">{workError}</p> : null}
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-3 sm:px-5 sm:py-6">
        {/* Date separator */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <span className="bg-[#F3F1ED] text-[11px] sm:text-xs text-gray-500 px-3 sm:px-4 py-0.5 sm:py-1 rounded-full font-medium tracking-wide shadow-sm">TODAY</span>
        </div>
        {chatMessages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            avatar={message.sender.avatar}
            onInternalLinkClick={handleInternalLinkClick}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-[#e8e6e1] bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:py-3">
        {selectedFile ? (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-[#EAE7E2] bg-[#F7F6F3] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-[#1a1a1a]">{selectedFile.name}</p>
              <p className="text-[11px] text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="*"
          className="hidden"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />

        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* Attachment button */}
          <button
            type="button"
            onClick={openFilePicker}
            disabled={!canSend || isSending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-[#F7F6F3] hover:text-gray-600 disabled:opacity-50 sm:h-11 sm:w-11"
          >
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Message input */}
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message here..."
              className="w-full rounded-[22px] border border-[#ece7df] bg-[#F7F6F3] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-orange-400/20 resize-none min-h-[40px] max-h-28 sm:min-h-[44px] sm:px-4 sm:py-3 sm:text-sm"
              rows={1}
              disabled={!canSend || isSending}
            />
          </div>

          {/* Send button */}
          <Button
            onClick={() => void handleSendMessage()}
            disabled={(!newMessage.trim() && !selectedFile) || !canSend || isSending}
            className="h-10 w-10 shrink-0 rounded-full bg-[#CC7000] p-0 text-white shadow-md hover:bg-[#A85C00] disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        
      </div>

     
    </div>

    {/* Dispute Form Modal */}
    {contractId && (
      <DisputeFormModal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        contractId={contractId}
        contractTitle={jobTitle || 'Contract'}
        raisedBy={(viewerRole_disputeRole ?? viewerRole) as 'client' | 'freelancer'}
      />
    )}
  </>
  );
}