<?php

namespace App\Mail;

use App\Models\MembershipPlan;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class LandingPlanInquiryMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public array $payload,
        public ?MembershipPlan $plan,
    ) {}

    public function envelope(): Envelope
    {
        $company = (string) ($this->payload['company_name'] ?? '');

        return new Envelope(
            subject: 'Solicitud de plan — '.$company,
            replyTo: [
                new Address(
                    (string) $this->payload['admin_email'],
                    (string) $this->payload['admin_full_name'],
                ),
            ],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.landing-plan-inquiry',
        );
    }
}
