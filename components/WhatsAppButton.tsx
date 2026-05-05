import Link from 'next/link';

interface Props {
  /** Phone number in international format without leading + (e.g. "905550000000"). */
  phone?: string;
  message?: string;
}

export default function WhatsAppButton({
  phone = '905550000000',
  message = 'Merhaba, CarettaPool hakkında bilgi almak istiyorum.',
}: Props) {
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp ile iletişime geç"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg ring-2 ring-white/40 transition-transform hover:scale-110 hover:bg-[#22c55e] focus:outline-none focus:ring-4 focus:ring-[#25d366]/40"
    >
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M16.001 3C9.378 3 4 8.378 4 15.001c0 2.32.671 4.555 1.94 6.491L4 29l7.683-1.911A12.001 12.001 0 0 0 16 27c6.625 0 12.001-5.375 12.001-12C28.001 8.378 22.626 3 16.001 3Zm0 21.6a9.6 9.6 0 0 1-4.876-1.336l-.349-.207-4.557 1.133 1.158-4.43-.227-.357A9.6 9.6 0 1 1 16.001 24.6Zm5.523-7.181c-.302-.151-1.787-.882-2.064-.982-.277-.1-.479-.151-.68.151-.202.302-.78.982-.957 1.184-.176.201-.352.227-.654.075-.302-.151-1.275-.47-2.428-1.498-.897-.8-1.504-1.79-1.68-2.092-.176-.302-.019-.465.132-.616.135-.135.302-.352.453-.529.151-.176.201-.302.302-.503.1-.201.05-.378-.025-.529-.076-.151-.68-1.638-.931-2.243-.245-.59-.494-.51-.68-.519-.176-.008-.378-.01-.579-.01-.201 0-.529.075-.806.378-.277.302-1.058 1.033-1.058 2.521 0 1.488 1.083 2.927 1.234 3.128.151.201 2.131 3.255 5.166 4.564.722.312 1.286.499 1.726.638.726.231 1.387.198 1.91.12.583-.087 1.787-.731 2.04-1.437.252-.706.252-1.31.176-1.437-.075-.126-.277-.201-.579-.352Z" />
      </svg>
    </Link>
  );
}
