import ServicePackageCheckout from './service-package-checkout';

type ServicePackageCartProps = {
  servicePackageId: string;
};

export default function ServicePackageCart({
  servicePackageId,
}: ServicePackageCartProps) {
  return (
    <ServicePackageCheckout
      servicePackageId={servicePackageId}
    />
  );
}
