import { CampaignList } from "../../../../features/communication/campaign-list";

export default function CampaignsPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Campaigns</h2>
      <CampaignList />
    </div>
  );
}
