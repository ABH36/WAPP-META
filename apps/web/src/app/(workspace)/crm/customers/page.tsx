import { CustomerList } from "../../../../features/crm/customer-list";

export default function CustomersPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Customers</h2>
      <CustomerList />
    </div>
  );
}
