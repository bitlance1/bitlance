'use client';

import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from '@/components/molecules/ChatHeader';
import ChatMessage from '@/components/molecules/ChatMessage';
import Button from '@/components/atoms/Button';
import { Copy, Send, Paperclip, X, ChevronDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
  paymentInstallments?: number;
  paymentCurrentInstallment?: number;
  paymentPaidAmountSats?: number;
  paymentRequest?: string;
  workStatus?: 'not_started' | 'in_progress' | 'submitted' | 'changes_requested' | 'approved' | 'completed';
  onCreatePaymentInvoice?: (installments: number) => Promise<string | void>;
  onVerifyPayment?: (paymentRequest?: string) => Promise<'funded' | 'pending' | 'expired'>;
}

export default function ChatView({
  message,
  chatMessages,
  onBack,
  onSendMessage,
  canSend = true,
  viewerRole = 'client',
  paymentStatus = 'unfunded',
  paymentAmountSats,
  paymentTotalAmountSats,
  paymentInstallments,
  paymentCurrentInstallment,
  paymentPaidAmountSats = 0,
  paymentRequest,
  workStatus = 'not_started',
  onCreatePaymentInvoice,
  onVerifyPayment,
}: ChatViewProps) {
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [activePaymentRequest, setActivePaymentRequest] = useState('');
  const [invoiceCopied, setInvoiceCopied] = useState(false);
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasPaidMilestone = paymentPaidAmountSats > 0 || paymentStatus === 'funded' || paymentStatus === 'released';
  const totalAmount = paymentTotalAmountSats || paymentAmountSats || 0;
  const activeInstallments = Math.max(
    1,
    Math.min(3, hasPaidMilestone ? paymentInstallments || 1 : selectedInstallments || paymentInstallments || 1)
  );
  const activeMilestone = Math.max(1, Math.min(activeInstallments, paymentCurrentInstallment || 1));
  const showCurrentInvoice =
    paymentStatus === 'invoice_created' &&
    !!paymentRequest &&
    activePaymentRequest === paymentRequest;
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
    !(paymentStatus === 'funded' && activeMilestone >= activeInstallments);
  const splitAmount = (installment: number, count = selectedInstallments) => {
    if (!totalAmount) return 0;
    const base = Math.floor(totalAmount / count);
    const remainder = totalAmount % count;
    return base + (installment <= remainder ? 1 : 0);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    if (!showCurrentInvoice || !onVerifyPayment || verificationComplete) return;

    const interval = window.setInterval(() => {
      void handleVerifyPayment({ silent: true });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [showCurrentInvoice, onVerifyPayment, verificationComplete]);

  useEffect(() => {
    setVerificationComplete(paymentStatus === 'funded' || paymentStatus === 'released');
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
      const newPaymentRequest = await onCreatePaymentInvoice(selectedInstallments);
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
    <div className="h-full flex flex-col bg-[#FCF9F7CC]">
      {/* Header */}
      <ChatHeader sender={message.sender} onBack={onBack} />

      <div className="border-b border-[#e8e6e1] bg-white px-3 py-3 sm:px-5 space-y-3">
        {/* Payment Section - Collapsible */}
        <div className="rounded-[12px] border border-[#EAE7E2] bg-[#F7F6F3]">
          {/* Payment Header - Always Visible */}
          <button
            type="button"
            onClick={() => setIsPaymentExpanded(!isPaymentExpanded)}
            className="w-full p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-[#f0ede8] transition-colors"
          >
            <div className="flex-1 text-left">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8C4F00]">
                Bitlance Escrow
              </div>
              <div className="mt-1 text-sm font-bold text-[#1a1a1a]">{paymentLabel}</div>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-[#8C4F00] transition-transform flex-shrink-0 ${
                isPaymentExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Payment Details - Expandable */}
          {isPaymentExpanded && (
            <div className="border-t border-[#EAE7E2] px-3 pb-3 pt-3 space-y-3">
              <div>
                <p className="text-[11px] leading-5 text-[#6b6762]">{paymentCopy}</p>
                {paymentAmountSats ? (
                  <p className="mt-1 text-[11px] font-semibold text-[#8C4F00]">
                    {paymentAmountSats.toLocaleString()} sats
                    {activeInstallments > 1 ? ` for milestone ${activeMilestone} of ${activeInstallments}` : ''}
                  </p>
                ) : null}
                {totalAmount && activeInstallments > 1 ? (
                  <p className="mt-1 text-[11px] text-[#6b6762]">
                    Total contract: {totalAmount.toLocaleString()} sats
                  </p>
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
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C4F00]">
                    Payment schedule
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
                        {count === 1 ? 'Once' : `${count} times`}
                      </button>
                    ))}
                  </div>
                  {totalAmount ? (
                    <p className="mt-2 text-[11px] leading-5 text-[#6b6762]">
                      First invoice: {splitAmount(1).toLocaleString()} sats from a {totalAmount.toLocaleString()} sats contract.
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] leading-5 text-[#6b6762]">
                      The contract amount will be split evenly when the invoice is created.
                    </p>
                  )}
                </div>
              ) : null}

              {viewerRole === 'client' && showCurrentInvoice ? (
                <div className="grid gap-3 sm:grid-cols-[140px_1fr] sm:items-center">
                  <div className="flex h-[140px] w-[140px] items-center justify-center rounded-[10px] border border-[#EAE7E2] bg-white">
                    <QRCodeSVG value={`lightning:${activePaymentRequest}`} size={120} />
                  </div>
                  <div className="rounded-[10px] bg-white p-2">
                    <p className="break-all px-1 py-1 text-[11px] leading-5 text-[#6b6762]">
                      {activePaymentRequest}
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
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1 sm:px-5 py-3 sm:py-6">
        {/* Date separator */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <span className="bg-[#F3F1ED] text-[11px] sm:text-xs text-gray-500 px-3 sm:px-4 py-0.5 sm:py-1 rounded-full font-medium tracking-wide shadow-sm">TODAY</span>
        </div>
        {chatMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} avatar={message.sender.avatar} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-[#e8e6e1] bg-white px-2 sm:px-4 py-2 sm:py-3">
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

        <div className="flex items-end gap-1 sm:gap-2">
          {/* Attachment button */}
          <button
            type="button"
            onClick={openFilePicker}
            disabled={!canSend || isSending}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
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
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#F7F6F3] border border-[#ece7df] rounded-full text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 resize-none min-h-[36px] sm:min-h-[44px] max-h-32"
              rows={1}
              disabled={!canSend || isSending}
            />
          </div>

          {/* Send button */}
          <Button
            onClick={() => void handleSendMessage()}
            disabled={(!newMessage.trim() && !selectedFile) || !canSend || isSending}
            className="p-2.5 sm:p-3 bg-[#CC7000] hover:bg-[#A85C00] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        
      </div>

     
    </div>
  );
}
