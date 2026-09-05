let nextGlobalCartCatalogReadPending = false;

/**
 * The existing Cart UI was intentionally left untouched. It still asks for
 * one store catalog to resolve product artwork, while the customer-facing Cart
 * now contains products from several real store groups.
 *
 * The route marks exactly one upcoming catalog read. catalog-service consumes
 * the marker once, so normal store/category catalog reads keep their original
 * behavior everywhere else in the app.
 */
export function markNextGlobalCartCatalogRead() {
  nextGlobalCartCatalogReadPending = true;
}

export function consumeNextGlobalCartCatalogRead() {
  const shouldAggregate =
    nextGlobalCartCatalogReadPending;

  nextGlobalCartCatalogReadPending = false;

  return shouldAggregate;
}
