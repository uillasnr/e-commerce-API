import * as Yup from 'yup';
import Category from '../models/Category';
import Product from '../models/Product';
import Order from '../schemas/Order';
import User from '../models/User';
import paymentController from './paymentController';



class OrderController {
  async store(request, response) {
    // Validando informações
    const schema = Yup.object().shape({
      products: Yup.array().of(
        Yup.object().shape({
          id: Yup.number().required(),
          quantity: Yup.number().required(),
        })
      ),
    });

    try {
      // Verifica as informações e retorna o erro
      await schema.validate(request.body, { abortEarly: false });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    const productsId = request.body.products.map((product) => product.id);

    // Pegando as informações do produto no postgres
    const updatedProducts = await Product.findAll({
      where: {
        id: productsId,
      },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['name'],
        },
      ],
    });

    const editedProduct = updatedProducts.map((product) => {
      const productIndex = request.body.products.findIndex(
        (requestProduct) => requestProduct.id === product.id
      );

      const newProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.name,
        url_img1: product.url_img1,
        quantity: request.body.products[productIndex].quantity,
      };

      return newProduct;
    });

    let totalPrice = 0; // inicializa a variável com valor zero

    editedProduct.forEach((product) => {
      totalPrice += product.price * product.quantity; // calcula o preço total de cada produto e acumula na variável
    });

    // Aqui você define a lógica para calcular o valor do frete.
    const freightValu = parseFloat(request.body.freightValu);

    const totalOrderValue = totalPrice + freightValu;
//console.log(totalOrderValue);
    const order = {
      user: {
        id: request.userId,
        name: request.userName,
      },
      products: editedProduct,
      status: 'Pedido realizado',
      totalPrice: totalOrderValue,// Adiciona o valor do frete ao preço total.
      //freightValu: freightValu,  // Salva o valor do frete no campo correspondente do pedido.
    };
//console.log(order);
    const orderResponse = await Order.create(order);

  
// Instead of creating the order here, you call the payment processing method and pass the order data
    try {
      await paymentController.store(request, response, order,totalOrderValue);
    } catch (error) {
      return response.status(500).json({ error: 'Failed to process payment' });
    }
  }

    //Para garantir que apenas uma ordem seja criada, você pode modificar o código para criar
    //a ordem apenas após o processamento do pagamento. Isso significa que você só criará a 
    // ordem se o pagamento for bem-sucedido.
  //  await paymentController.store(request, response, order);

    // return response.status(201).json(orderResponse);  
 // }
//////////////////////////////////////////////////////////////


  // Obtém o último pedido com base na data de criação (ordenado de forma decrescente)
  async getLastOrder(request, response) {
    try {
      const lastOrder = await Order.findOne({}, {}, { sort: { 'createdAt': -1 } });
      return response.json(lastOrder);
    } catch (error) {
      return response.status(500).json({ error: 'Failed to retrieve the last order' });
    }
  }


  // Mostrar todos os pedidos
  async index(request, response) {
    const orders = await Order.find();

    return response.json(orders);
  }

  // Atualizando Status do pedido
  async update(request, response) {
    // Validando informações
    const schema = Yup.object().shape({
      status: Yup.string().required(),
    });

    try {
      // Verifica as informações e retorna o erro
      await schema.validate(request.body, { abortEarly: false });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    // Definindo que administradores podem atualizar pedidos
    const { admin: isAdmin } = await User.findByPk(request.userId);

    if (!isAdmin) {
      return response.status(401).json();
    }

    const { id } = request.params;
    const { status } = request.body;

    // Validando id de pedido
    try {
      await Order.updateOne({ _id: id }, { status });
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }

    return response.json({ message: 'Status updated successfully' });
  }
}

export default new OrderController();
