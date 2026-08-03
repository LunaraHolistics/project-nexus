/**
 * Helper de paginação reutilizável
 */
function paginate(query, countQuery, params, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  
  const items = query.all(...params, limit, offset);
  const { total } = countQuery.get(...params);
  
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
}

module.exports = { paginate };