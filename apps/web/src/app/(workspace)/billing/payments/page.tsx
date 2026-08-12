import { PaymentList } from "../../../../features/billing/payment-list";

export default function PaymentsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Payments</h2>
      <PaymentList />
    </div>
  );
}
