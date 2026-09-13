import React, { useState, useEffect } from 'react';
import { ShoppingBag, LayoutDashboard, Plus, Minus, DollarSign, Package, Lock, LogOut, Trash2 } from 'lucide-react';

// DEFINE SEU USUÁRIO E SENHA AQUI
const ADMIN_USER = "admin";
const ADMIN_PASS = "123456";

// Tente importar o supabase com segurança
let supabase = null;
try {
  const { supabase: client } = await import('./lib/supabase');
  supabase = client;
} catch (e) {
  console.log("Supabase não configurado ainda.");
}

const PRODUCTS = [
  {
    id: 'pao-tradicional',
    name: 'Pão Caseiro Tradicional',
    description: 'Pão fofinho, artesanal e fresquinho. Perfeito para o café da manhã ou da tarde.',
    price: 15.00,
    available: true,
    tag: 'Carro Chefe'
  },
  {
    id: 'pao-recheado',
    name: 'Pão Recheado',
    description: 'Massa macia recheada com sabores deliciosos da casa.',
    price: 28.00,
    available: false,
    tag: 'Em Breve'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('cliente');
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [balcaoCount, setBalcaoCount] = useState(0);

  // Estados de Autenticação ERP
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ usuario: '', senha: '' });
  const [loginError, setLoginError] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    metodo: 'retirada',
    endereco: '',
    diaFornada: 'Sexta-feira'
  });

  useEffect(() => {
    fetchOrders();
    fetchBalcao();
  }, []);

  async function fetchOrders() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setOrders(data);
    } catch (err) {
      console.log(err);
    }
  }

  async function fetchBalcao() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('vendas_balcao')
        .select('quantidade');
      if (!error && data) {
        const total = data.reduce((acc, curr) => acc + curr.quantidade, 0);
        setBalcaoCount(total);
      }
    } catch (err) {
      console.log(err);
    }
  }

  const addToCart = (product) => {
    if (!product.available) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const deliveryFee = formData.metodo === 'entrega' ? 5.00 : 0.00;
  const finalTotal = cartTotal + deliveryFee;

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert('Adicione pelo menos um pão ao carrinho!');

    const newOrder = {
      cliente_nome: formData.nome,
      cliente_telefone: formData.telefone,
      metodo_entrega: formData.metodo,
      endereco: formData.metodo === 'entrega' ? formData.endereco : 'Retirada no Local',
      dia_fornada: formData.diaFornada,
      itens: cart,
      total: finalTotal,
      status: 'Pendente'
    };

    if (supabase) {
      try {
        await supabase.from('pedidos').insert([newOrder]);
        fetchOrders();
      } catch (err) {
        console.log(err);
      }
    } else {
      setOrders(prev => [newOrder, ...prev]);
    }

    const itensTexto = cart.map(i => `${i.qty}x ${i.name}`).join('%0A');
    const msg = `*Novo Pedido - Padaria Xuxuzão*%0A%0A` +
      `*Cliente:* ${formData.nome}%0A` +
      `*Telefone:* ${formData.telefone}%0A` +
      `*Dia da Fornada:* ${formData.diaFornada}%0A` +
      `*Entrega:* ${formData.metodo === 'entrega' ? `Entrega em ${formData.endereco}` : 'Retirada no Local'}%0A%0A` +
      `*Itens:*%0A${itensTexto}%0A%0A` +
      `*Total:* R$ ${finalTotal.toFixed(2)}`;

    window.open(`https://wa.me/?text=${msg}`, '_blank');

    setCart([]);
    setFormData({ nome: '', telefone: '', metodo: 'retirada', endereco: '', diaFornada: 'Sexta-feira' });
    alert('Pedido registrado com sucesso!');
  };

  // Alterar vendas do balcão (Soma ou Subtração)
  const alterBalcaoSale = async (qty) => {
    if (qty < 0 && balcaoCount + qty < 0) {
      return alert('Não é possível ter uma quantidade negativa de pães no balcão!');
    }

    if (supabase) {
      try {
        await supabase.from('vendas_balcao').insert([{ quantidade: qty, valor_total: qty * 15.00 }]);
        fetchBalcao();
      } catch (err) {
        console.log(err);
      }
    } else {
      setBalcaoCount(prev => Math.max(0, prev + qty));
    }
  };

  // Excluir encomenda
  const handleDeleteOrder = async (orderToDelete) => {
    if (!window.confirm(`Tem certeza que deseja cancelar/remover a encomenda de ${orderToDelete.cliente_nome}?`)) {
      return;
    }

    if (supabase && orderToDelete.id) {
      try {
        const { error } = await supabase.from('pedidos').delete().eq('id', orderToDelete.id);
        if (error) {
          alert('Erro ao excluir pedido no banco de dados.');
          console.log(error);
        } else {
          fetchOrders();
        }
      } catch (err) {
        console.log(err);
      }
    } else {
      setOrders(prev => prev.filter(o => o !== orderToDelete));
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginForm.usuario === ADMIN_USER && loginForm.senha === ADMIN_PASS) {
      setIsLoggedIn(true);
      setLoginError('');
      setLoginForm({ usuario: '', senha: '' });
    } else {
      setLoginError('Usuário ou senha incorretos.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab('cliente');
  };

  const faturamentoEncomendas = orders.reduce((acc, item) => acc + Number(item.total || 0), 0);
  const faturamentoBalcao = balcaoCount * 15.00;
  const faturamentoTotal = faturamentoEncomendas + faturamentoBalcao;
  const totalPaesVendidos = balcaoCount + orders.reduce((acc, order) => {
    const itens = Array.isArray(order.itens) ? order.itens : [];
    return acc + itens.reduce((sum, item) => sum + (item.qty || 0), 0);
  }, 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fffbeb', color: '#292524', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#92400e', color: '#fffbeb', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🍞</span>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Padaria Xuxuzão</h1>
              <p style={{ fontSize: '0.75rem', color: '#fef3c7', margin: 0 }}>Pães artesanais feitos com carinho</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('cliente')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                backgroundColor: activeTab === 'cliente' ? '#d97706' : 'transparent',
                color: '#ffffff'
              }}
            >
              Fazer Encomenda
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                backgroundColor: activeTab === 'admin' ? '#d97706' : 'transparent',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <LayoutDashboard size={16} /> Painel ERP
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO CLIENTE */}
      {activeTab === 'cliente' && (
        <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Cardápio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', color: '#78350f', margin: 0 }}>Cardápio de Pães</h2>
              <p style={{ fontSize: '0.875rem', color: '#57534e', margin: '0.25rem 0 0 0' }}>Garanta seus pães quentinhos para a próxima fornada!</p>
            </div>

            {PRODUCTS.map((product) => (
              <div 
                key={product.id}
                style={{
                  backgroundColor: product.available ? '#ffffff' : '#f5f5f4',
                  borderRadius: '1rem',
                  padding: '1.25rem',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: product.available ? 1 : 0.75
                }}
              >
                <div style={{ maxWidth: '70%' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '1rem',
                    fontWeight: 'bold',
                    backgroundColor: product.available ? '#fef3c7' : '#e7e5e4',
                    color: product.available ? '#92400e' : '#57534e'
                  }}>
                    {product.tag}
                  </span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem 0' }}>{product.name}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#78716c', margin: 0 }}>{product.description}</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#b45309', margin: '0.5rem 0 0 0' }}>
                    R$ {product.price.toFixed(2)}
                  </p>
                </div>

                <div>
                  {product.available ? (
                    <button
                      onClick={() => addToCart(product)}
                      style={{
                        backgroundColor: '#b45309',
                        color: '#ffffff',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.75rem',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <Plus size={16} /> Adicionar
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#a8a29e', backgroundColor: '#e7e5e4', padding: '0.4rem 0.75rem', borderRadius: '0.5rem' }}>
                      Indisponível
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Carrinho / Form */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #fde68a', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#78350f', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag size={20} /> Seu Pedido
            </h3>

            {cart.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#a8a29e', fontSize: '0.875rem', padding: '2rem 0' }}>
                Seu carrinho está vazio.<br />Escolha um pão ao lado!
              </p>
            ) : (
              <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f5f5f4', paddingBottom: '0.5rem' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.875rem' }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#78716c' }}>R$ {item.price.toFixed(2)} un.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button type="button" onClick={() => updateCartQty(item.id, -1)} style={{ padding: '0.2rem 0.5rem' }}><Minus size={12}/></button>
                      <span style={{ fontWeight: 'bold' }}>{item.qty}</span>
                      <button type="button" onClick={() => updateCartQty(item.id, 1)} style={{ padding: '0.2rem 0.5rem' }}><Plus size={12}/></button>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Seu Nome</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Gabriel"
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d6d3d1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>WhatsApp / Telefone</label>
                  <input
                    type="text"
                    required
                    placeholder="(11) 99999-9999"
                    value={formData.telefone}
                    onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d6d3d1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Dia da Fornada</label>
                  <select
                    value={formData.diaFornada}
                    onChange={e => setFormData({ ...formData, diaFornada: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d6d3d1', backgroundColor: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="Quarta-feira">Quarta-feira</option>
                    <option value="Sexta-feira">Sexta-feira</option>
                    <option value="Sábado">Sábado</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Entrega ou Retirada</label>
                  <select
                    value={formData.metodo}
                    onChange={e => setFormData({ ...formData, metodo: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d6d3d1', backgroundColor: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="retirada">Retirar no Local (Grátis)</option>
                    <option value="entrega">Entrega em Casa (+ R$ 5,00)</option>
                  </select>
                </div>

                {formData.metodo === 'entrega' && (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Endereço de Entrega</label>
                    <input
                      type="text"
                      required
                      placeholder="Rua, Número e Bairro"
                      value={formData.endereco}
                      onChange={e => setFormData({ ...formData, endereco: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #d6d3d1', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div style={{ borderTop: '1px solid #e7e5e4', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold', color: '#78350f' }}>
                    <span>Total</span>
                    <span>R$ {finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    backgroundColor: '#b45309',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '0.5rem'
                  }}
                >
                  Enviar para o WhatsApp
                </button>
              </form>
            )}
          </div>
        </main>
      )}

      {/* PAINEL ADMIN / CONTABILIDADE OU TELA DE LOGIN */}
      {activeTab === 'admin' && (
        !isLoggedIn ? (
          /* TELA DE LOGIN */
          <main style={{ maxWidth: '400px', margin: '4rem auto', padding: '0 1rem' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '2rem', borderRadius: '1rem', border: '1px solid #fde68a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#fef3c7', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                  <Lock size={24} color="#92400e" />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#78350f', margin: 0 }}>Acesso Restrito</h2>
                <p style={{ fontSize: '0.875rem', color: '#78716c', margin: '0.25rem 0 0 0' }}>Digite suas credenciais do Painel ERP</p>
              </div>

              {loginError && (
                <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Usuário</label>
                  <input
                    type="text"
                    required
                    placeholder="Usuário"
                    value={loginForm.usuario}
                    onChange={e => setLoginForm({ ...loginForm, usuario: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #d6d3d1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Senha</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginForm.senha}
                    onChange={e => setLoginForm({ ...loginForm, senha: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #d6d3d1', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    backgroundColor: '#92400e',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '0.5rem'
                  }}
                >
                  Entrar no ERP
                </button>
              </form>
            </div>
          </main>
        ) : (
          /* PAINEL ERP AUTENTICADO */
          <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#78350f', margin: 0 }}>Painel Administrativo</h2>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.875rem'
                }}
              >
                <LogOut size={16} /> Sair
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #fde68a' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#78716c', margin: 0, textTransform: 'uppercase' }}>Faturamento Total</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#78350f', margin: '0.25rem 0' }}>R$ {faturamentoTotal.toFixed(2)}</p>
                <p style={{ fontSize: '0.75rem', color: '#16a34a', margin: 0, fontWeight: 'bold' }}>Lucro Limpo: ~R$ {(faturamentoTotal * 0.65).toFixed(2)}</p>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #fde68a' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#78716c', margin: 0, textTransform: 'uppercase' }}>Pães Vendidos</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#78350f', margin: '0.25rem 0' }}>{totalPaesVendidos} unidades</p>
                <p style={{ fontSize: '0.75rem', color: '#78716c', margin: 0 }}>{orders.length} encomendas + {balcaoCount} balcão</p>
              </div>

              {/* Controle de Vendas do Balcão */}
              <div style={{ backgroundColor: '#78350f', color: '#ffffff', padding: '1.25rem', borderRadius: '1rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fef3c7', margin: 0, textTransform: 'uppercase' }}>Venda Rápida de Balcão</p>
                <p style={{ fontSize: '0.75rem', color: '#fef3c7', margin: '0.25rem 0 0.5rem 0' }}>Somar ou Subtrair pães avulsos (R$ 15,00 un):</p>
                
                {/* Botões de Adição */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button onClick={() => alterBalcaoSale(1)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#d97706', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>+1 Pão</button>
                  <button onClick={() => alterBalcaoSale(2)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#d97706', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>+2 Pães</button>
                  <button onClick={() => alterBalcaoSale(5)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#d97706', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>+5 Pães</button>
                </div>

                {/* Botões de Subtração */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => alterBalcaoSale(-1)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', border: '1px solid #b45309', backgroundColor: '#92400e', color: '#fef3c7', fontWeight: 'bold', cursor: 'pointer' }}>-1 Pão</button>
                  <button onClick={() => alterBalcaoSale(-2)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', border: '1px solid #b45309', backgroundColor: '#92400e', color: '#fef3c7', fontWeight: 'bold', cursor: 'pointer' }}>-2 Pães</button>
                  <button onClick={() => alterBalcaoSale(-5)} style={{ flex: 1, padding: '0.4rem', borderRadius: '0.5rem', border: '1px solid #b45309', backgroundColor: '#92400e', color: '#fef3c7', fontWeight: 'bold', cursor: 'pointer' }}>-5 Pães</button>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #fde68a' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#78350f', margin: '0 0 1rem 0' }}>Lista de Encomendas</h3>
              {orders.length === 0 ? (
                <p style={{ color: '#a8a29e', fontSize: '0.875rem', textAlign: 'center' }}>Nenhuma encomenda registrada ainda.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {orders.map((o, idx) => (
                    <li key={o.id || idx} style={{ padding: '0.75rem', backgroundColor: '#fffbeb', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{o.cliente_nome}</strong> ({o.cliente_telefone}) - {o.dia_fornada}
                        <br />
                        <small style={{ color: '#78716c' }}>{o.metodo_entrega === 'entrega' ? `Entrega: ${o.endereco}` : 'Retirada'}</small>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontWeight: 'bold', color: '#b45309' }}>
                          R$ {Number(o.total || 0).toFixed(2)}
                        </div>
                        <button
                          onClick={() => handleDeleteOrder(o)}
                          title="Cancelar/Excluir Encomenda"
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: '0.375rem',
                            padding: '0.35rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </main>
        )
      )}
    </div>
  );
}