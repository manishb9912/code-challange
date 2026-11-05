import { screen } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { product } from '../../../test/data';
import { renderApp } from '../../../test/render';
import { API, errorResponse, server } from '../../../test/server';

const ring = product({ id: '7', title: 'White Gold Ring' });

/** Serves the product and records every enquiry body the API receives. */
function mockEnquiryApi(
  respond: () => Response | Promise<Response> = () =>
    HttpResponse.json({ id: 'enq-1' }, { status: 201 }),
) {
  const bodies: unknown[] = [];
  server.use(
    http.get(API('/products/7'), () => HttpResponse.json(ring)),
    http.post(API('/enquiries'), async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    }),
  );
  return bodies;
}

async function fillContactDetails(user: ReturnType<typeof renderApp>['user']) {
  await user.type(await screen.findByLabelText('Name'), 'Ada Lovelace');
  await user.type(screen.getByLabelText('Email'), 'ada@example.com');
  await user.type(screen.getByLabelText(/Message/), 'Is this available in size 7?');
}

describe('Enquiry', () => {
  it('GIVEN I am viewing a product AND click Enquire AND complete the form WHEN I submit THEN I see a "Thank you" message', async () => {
    const bodies = mockEnquiryApi();
    const { user } = renderApp('/product/7');

    await user.click(await screen.findByRole('link', { name: 'Enquire' }));
    await fillContactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    const heading = await screen.findByRole('heading', { name: 'Thank you' });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/received your enquiry about/)).toHaveTextContent('White Gold Ring');
    expect(screen.getByRole('link', { name: 'Back to White Gold Ring' })).toHaveAttribute(
      'href',
      '/product/7',
    );
    expect(bodies).toEqual([
      {
        productId: '7',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '',
        message: 'Is this available in size 7?',
        website: '',
      },
    ]);
  });

  it('shows an error and keeps what I typed when the email could not be sent', async () => {
    mockEnquiryApi(() =>
      errorResponse(
        502,
        'MAIL_DELIVERY_FAILED',
        'We could not send your enquiry. Please try again.',
      ),
    );
    const { user } = renderApp('/product/7/enquire');

    await fillContactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not send your enquiry. Please try again.',
    );
    expect(screen.queryByRole('heading', { name: 'Thank you' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByRole('button', { name: 'Send enquiry' })).toBeEnabled();
  });

  it('explains rate limiting (429) in plain language and keeps the form', async () => {
    mockEnquiryApi(() => errorResponse(429, 'RATE_LIMITED', 'Too many requests.'));
    const { user } = renderApp('/product/7/enquire');

    await fillContactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You have sent several enquiries in a short time',
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Ada Lovelace');
  });

  it('shows inline validation errors and sends nothing when required fields are missing', async () => {
    const bodies = mockEnquiryApi();
    const { user } = renderApp('/product/7/enquire');

    await user.type(await screen.findByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByText('Please enter your name')).toBeInTheDocument();
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(bodies).toHaveLength(0);
  });

  it('shows server-side field errors inline', async () => {
    mockEnquiryApi(() =>
      HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [{ path: 'email', message: 'Email address is not accepted' }],
            requestId: 'r1',
          },
        },
        { status: 400 },
      ),
    );
    const { user } = renderApp('/product/7/enquire');

    await fillContactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    expect(await screen.findByText('Email address is not accepted')).toBeInTheDocument();
  });

  it('disables the submit button while sending (no double submits)', async () => {
    const bodies = mockEnquiryApi(async () => {
      await delay(50);
      return HttpResponse.json({ id: 'enq-1' }, { status: 201 });
    });
    const { user } = renderApp('/product/7/enquire');

    await fillContactDetails(user);
    await user.click(screen.getByRole('button', { name: 'Send enquiry' }));

    const button = await screen.findByRole('button', { name: 'Sending…' });
    expect(button).toBeDisabled();
    await user.click(button);
    await screen.findByRole('heading', { name: 'Thank you' });
    expect(bodies).toHaveLength(1);
  });

  it('keeps the honeypot field out of the accessibility tree', async () => {
    mockEnquiryApi();
    renderApp('/product/7/enquire');
    await screen.findByLabelText('Name');
    expect(screen.queryByRole('textbox', { name: 'Website' })).not.toBeInTheDocument();
  });

  it('shows the privacy notice', async () => {
    mockEnquiryApi();
    renderApp('/product/7/enquire');
    expect(
      await screen.findByText('We will use these details only to respond to your enquiry.'),
    ).toBeInTheDocument();
  });
});
